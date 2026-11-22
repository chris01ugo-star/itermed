export type LogLevel = "debug" | "info" | "warn" | "error";

/** Structured metadata attached to log entries (e.g. `caseId`, `userId`). */
export type LogMeta = Record<string, unknown>;

type LogEntry = {
  level: LogLevel;
  message: string;
  timestamp: string;
  service?: string;
} & LogMeta;

export type Logger = {
  debug: (message: string, meta?: LogMeta) => void;
  info: (message: string, meta?: LogMeta) => void;
  warn: (message: string, meta?: LogMeta) => void;
  error: (message: string, meta?: LogMeta) => void;
  child: (bindings: LogMeta) => Logger;
};

function serializeError(error: unknown): LogMeta | undefined {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      ...(error.stack ? { errorStack: error.stack } : {}),
    };
  }
  if (error !== undefined) {
    return { errorDetail: String(error) };
  }
  return undefined;
}

function writeLog(level: LogLevel, message: string, meta?: LogMeta, service?: string): void {
  if (level === "debug" && process.env.NODE_ENV === "production") {
    return;
  }

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(service ? { service } : {}),
    ...meta,
  };

  const line = JSON.stringify(entry);

  switch (level) {
    case "error":
      console.error(line);
      break;
    case "warn":
      console.warn(line);
      break;
    default:
      console.log(line);
  }
}

function buildLogger(service?: string, bindings: LogMeta = {}): Logger {
  const withBindings = (meta?: LogMeta): LogMeta => ({ ...bindings, ...meta });

  return {
    debug: (message, meta) => writeLog("debug", message, withBindings(meta), service),
    info: (message, meta) => writeLog("info", message, withBindings(meta), service),
    warn: (message, meta) => writeLog("warn", message, withBindings(meta), service),
    error: (message, meta) => {
      const errorMeta = meta?.error !== undefined ? serializeError(meta.error) : undefined;
      const { error: _error, ...rest } = meta ?? {};
      writeLog("error", message, { ...withBindings(rest), ...errorMeta }, service);
    },
    child: (childBindings) => buildLogger(service, { ...bindings, ...childBindings }),
  };
}

/** Root application logger. Prefer {@link createLogger} for service-scoped logs. */
export const logger = buildLogger("itermed");

/**
 * Creates a logger scoped to a subsystem (e.g. `rag-service`, `evaluation-service`).
 */
export function createLogger(service: string, bindings: LogMeta = {}): Logger {
  return buildLogger(service, bindings);
}
