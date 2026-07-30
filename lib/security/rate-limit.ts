import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type RateBucket = {
  count: number;
  resetAt: number;
};

export const RATE_LIMIT_MESSAGE =
  "Hai superato il limite di richieste consentite. Riprova tra un minuto.";

const WINDOW_MS = 60_000;
const buckets = new Map<string, RateBucket>();

/** Cached Upstash limiters keyed by `namespace:limit` (different routes use different caps). */
const upstashLimiters = new Map<string, Ratelimit>();
let redisSingleton: Redis | null | undefined;

function pruneExpiredBuckets(now: number): void {
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) {
      buckets.delete(key);
    }
  }
}

export function isUpstashRateLimitConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  );
}

/** Shared Upstash Redis client (null when env is unset). Used by rate-limit + embedding cache. */
export function getUpstashRedis(): Redis | null {
  if (redisSingleton !== undefined) return redisSingleton;

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    redisSingleton = null;
    return null;
  }

  redisSingleton = new Redis({ url, token });
  return redisSingleton;
}

function getUpstashLimiter(namespace: string, limit: number): Ratelimit | null {
  const redis = getUpstashRedis();
  if (!redis) return null;

  const cacheKey = `${namespace}:${limit}`;
  const cached = upstashLimiters.get(cacheKey);
  if (cached) return cached;

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, "1 m"),
    prefix: `aequan:${namespace}`,
    analytics: false,
  });
  upstashLimiters.set(cacheKey, limiter);
  return limiter;
}

/**
 * Prefer authenticated `userId`; fall back to client IP for anonymous callers.
 * Combined with `namespace` this scopes abuse protection per route + actor.
 */
export function getRateLimitIdentifier(request: Request, userId?: string | null): string {
  if (userId) {
    return `user:${userId}`;
  }

  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown";

  return `ip:${ip}`;
}

export type RateLimitCheckResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

/**
 * In-memory fixed-window limiter — local/dev/test fallback when Upstash is unset
 * or when the Redis call fails.
 */
export function checkInMemoryRateLimit(
  key: string,
  limit: number,
  windowMs = WINDOW_MS,
): RateLimitCheckResult {
  const now = Date.now();
  pruneExpiredBuckets(now);

  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  return { allowed: true };
}

async function checkUpstashRateLimit(
  namespace: string,
  identifier: string,
  limit: number,
): Promise<RateLimitCheckResult | null> {
  const limiter = getUpstashLimiter(namespace, limit);
  if (!limiter) return null;

  try {
    // Key = namespace-scoped identity (userId preferred) shared across all Vercel instances.
    const { success, reset } = await limiter.limit(identifier);
    if (success) return { allowed: true };

    const retryAfterSeconds = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    return { allowed: false, retryAfterSeconds };
  } catch (error) {
    console.warn(
      "[rate-limit] Upstash unavailable — falling back to in-memory limiter",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/**
 * Distributed (Upstash) when env is set; otherwise in-memory for local/test.
 * Key always includes `namespace` + user/IP identifier.
 */
export async function checkRateLimit(
  request: Request,
  params: { namespace: string; limit: number; userId?: string | null },
): Promise<RateLimitCheckResult> {
  const identifier = getRateLimitIdentifier(request, params.userId);
  const memoryKey = `${params.namespace}:${identifier}`;

  const distributed = await checkUpstashRateLimit(
    params.namespace,
    identifier,
    params.limit,
  );
  if (distributed) return distributed;

  return checkInMemoryRateLimit(memoryKey, params.limit);
}

export function rateLimitExceededResponse(retryAfterSeconds = 60): Response {
  return new Response(JSON.stringify({ error: RATE_LIMIT_MESSAGE }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(retryAfterSeconds),
    },
  });
}

/**
 * Returns a 429 Response when the limit is exceeded, otherwise `null`.
 * Uses Upstash Redis when `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
 * are set; otherwise falls back to the in-process Map (dev/test safe).
 */
export async function enforceRateLimit(
  request: Request,
  params: { namespace: string; limit: number; userId?: string | null },
): Promise<Response | null> {
  const result = await checkRateLimit(request, params);

  if (!result.allowed) {
    return rateLimitExceededResponse(result.retryAfterSeconds);
  }

  return null;
}

/** Alias used by AI-backed routes (same backend as {@link enforceRateLimit}). */
export const enforceLLMRateLimit = enforceRateLimit;
