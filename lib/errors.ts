/** HTTP status codes supported by {@link AppError}. */
export type HttpStatusCode = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 502 | 503;

/**
 * Base class for domain errors with a stable HTTP mapping and a safe public message.
 */
export class AppError extends Error {
  readonly statusCode: HttpStatusCode;
  readonly code: string;
  readonly publicMessage: string;
  readonly cause?: unknown;

  constructor(params: {
    message: string;
    publicMessage: string;
    statusCode: HttpStatusCode;
    code: string;
    cause?: unknown;
  }) {
    super(params.message);
    this.name = new.target.name;
    this.statusCode = params.statusCode;
    this.code = params.code;
    this.publicMessage = params.publicMessage;
    this.cause = params.cause;
  }
}

/** Thrown when request input fails schema or business validation. */
export class ValidationError extends AppError {
  constructor(message: string, cause?: unknown) {
    super({
      message,
      publicMessage: message,
      statusCode: 400,
      code: "VALIDATION_ERROR",
      cause,
    });
  }
}

/** Thrown when an upstream AI provider call fails. */
export class AIServiceError extends AppError {
  constructor(message = "AI evaluation service is temporarily unavailable.", cause?: unknown) {
    const causeText =
      cause instanceof Error
        ? cause.message
        : typeof cause === "string" && cause.trim()
          ? cause.trim()
          : null;
    super({
      // Preserve upstream detail in `.message` so workers/logs are actionable.
      message: causeText ? `${message}: ${causeText.slice(0, 400)}` : message,
      publicMessage: message,
      statusCode: 503,
      code: "AI_SERVICE_ERROR",
      cause,
    });
  }

  static fromUnknown(error: unknown): AIServiceError {
    if (error instanceof AIServiceError) return error;
    const detail = error instanceof Error ? error.message : String(error);
    return new AIServiceError(
      "AI evaluation service is temporarily unavailable.",
      error instanceof Error ? error : detail,
    );
  }
}

/** Thrown when guideline retrieval (RAG) fails unexpectedly. */
export class RAGServiceError extends AppError {
  constructor(message = "Guideline retrieval service is temporarily unavailable.", cause?: unknown) {
    const causeText =
      cause instanceof Error
        ? cause.message
        : typeof cause === "string" && cause.trim()
          ? cause.trim()
          : null;
    super({
      message: causeText ? `${message}: ${causeText.slice(0, 400)}` : message,
      publicMessage: message,
      statusCode: 503,
      code: "RAG_SERVICE_ERROR",
      cause,
    });
  }

  static fromUnknown(error: unknown): RAGServiceError {
    if (error instanceof RAGServiceError) return error;
    const detail = error instanceof Error ? error.message : String(error);
    return new RAGServiceError(
      "Guideline retrieval service is temporarily unavailable.",
      error instanceof Error ? error : detail,
    );
  }
}

/** Thrown when a client exceeds configured request quotas. */
export class RateLimitError extends AppError {
  constructor(
    message = "Hai superato il limite di richieste consentite. Riprova tra un minuto.",
    cause?: unknown,
  ) {
    super({
      message,
      publicMessage: message,
      statusCode: 429,
      code: "RATE_LIMIT_EXCEEDED",
      cause,
    });
  }
}

/** Thrown when persisted KnowledgeBaseCase JSONB fails runtime Zod validation. */
export class KnowledgeBaseCaseValidationError extends AppError {
  readonly caseId: string;
  readonly field: string;
  readonly issues: Array<{ path: string; message: string }>;

  constructor(
    caseId: string,
    field: string,
    issues: Array<{ path: string; message: string }>,
    cause?: unknown,
  ) {
    const preview = issues[0] ? `${issues[0].path}: ${issues[0].message}` : "schema error";
    super({
      message: `KnowledgeBaseCase ${caseId} failed Zod parse at ${field} (${preview})`,
      publicMessage: `Il caso clinico ${caseId} non è valido e non può essere caricato nel simulatore.`,
      statusCode: 422,
      code: "KB_CASE_VALIDATION_ERROR",
      cause,
    });
    this.caseId = caseId;
    this.field = field;
    this.issues = issues;
  }
}

/** Thrown when environment configuration is invalid (usually at startup). */
export class ConfigurationError extends AppError {
  constructor(message: string, cause?: unknown) {
    super({
      message,
      publicMessage: "Server configuration error.",
      statusCode: 500,
      code: "CONFIGURATION_ERROR",
      cause,
    });
  }
}

export type ApiErrorPayload = {
  error: string;
  code?: string;
};

/**
 * Maps known errors to a safe JSON HTTP response without leaking internal details.
 */
export function toApiErrorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    const payload: ApiErrorPayload = {
      error: error.publicMessage,
      code: error.code,
    };

    return new Response(JSON.stringify(payload), {
      status: error.statusCode,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      error: "An unexpected error occurred.",
      code: "INTERNAL_ERROR",
    } satisfies ApiErrorPayload),
    {
      status: 500,
      headers: { "Content-Type": "application/json" },
    },
  );
}
