/** Cap evaluation JSON output — structured schema is large but unbounded generation burns cost. */
export const EVALUATION_MAX_OUTPUT_TOKENS = 4500;

/** Shared per-minute limits for OpenAI-backed / abuse-sensitive API routes. */
export const AI_RATE_LIMITS = {
  /**
   * Max patient-chat turns per authenticated user per minute.
   * Anti-DoS / automation guard — does not replace the per-session anamnesis cap (35).
   */
  chat: 10,
  /** Evaluation / forensic report generation (alias: /api/evaluate). */
  simulationReport: 3,
  /** Analytics dashboard data refresh. */
  analytics: 20,
  sessionStart: 10,
  sessionStartVariant: 3,
  examine: 20,
  generateExams: 8,
  generateCaseFields: 8,
  casesCreate: 10,
  casesRead: 60,
  checkDiagnosis: 15,
  sessionOutcome: 10,
  sessionComplication: 10,
  register: 5,
} as const;

/** Explicit alias for chat anti-abuse (10 messages / user / minute). */
export const CHAT_MESSAGES_PER_MINUTE = AI_RATE_LIMITS.chat;