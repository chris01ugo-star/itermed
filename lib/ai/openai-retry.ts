import "server-only";
import { createLogger } from "@/lib/logger";

const log = createLogger("openai-retry");

export type OpenAIRetryOptions = {
  /** Total attempts including the first call (default 3). */
  maxAttempts?: number;
  /** Initial delay before first retry (default 400ms). */
  baseDelayMs?: number;
  /** Cap on exponential delay (default 8s). */
  maxDelayMs?: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const record = error as Record<string, unknown>;
  if (typeof record.statusCode === "number") return record.statusCode;
  if (typeof record.status === "number") return record.status;
  if (record.response && typeof record.response === "object") {
    const status = (record.response as { status?: unknown }).status;
    if (typeof status === "number") return status;
  }
  if (record.cause && typeof record.cause === "object") {
    return readStatusCode(record.cause);
  }
  return undefined;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error ?? "");
}

/**
 * True for OpenAI rate limits, transient upstream failures, and common network timeouts.
 */
export function isRetryableOpenAIError(error: unknown): boolean {
  const status = readStatusCode(error);
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 529) {
    return true;
  }

  const message = errorMessage(error).toLowerCase();
  if (
    message.includes("429") ||
    message.includes("rate limit") ||
    message.includes("too many requests") ||
    message.includes("timeout") ||
    message.includes("etimedout") ||
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("fetch failed") ||
    message.includes("socket hang up") ||
    message.includes("network")
  ) {
    return true;
  }

  return false;
}

function computeDelayMs(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const exp = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
  const jitter = Math.floor(Math.random() * Math.min(250, exp * 0.2));
  return exp + jitter;
}

/**
 * Retries an async OpenAI call with exponential backoff on 429 / transient network errors.
 */
export async function withOpenAIRetry<T>(
  fn: () => Promise<T>,
  options: OpenAIRetryOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 400;
  const maxDelayMs = options.maxDelayMs ?? 8_000;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const retryable = isRetryableOpenAIError(error);
      if (!retryable || attempt >= maxAttempts) {
        throw error;
      }
      const delayMs = computeDelayMs(attempt, baseDelayMs, maxDelayMs);
      log.warn("OpenAI call failed; retrying with backoff", {
        attempt,
        maxAttempts,
        delayMs,
        status: readStatusCode(error),
        error: errorMessage(error).slice(0, 200),
      });
      await sleep(delayMs);
    }
  }

  throw lastError;
}
