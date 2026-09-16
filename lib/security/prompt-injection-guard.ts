const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/gi,
  /disregard\s+(all\s+)?(previous|prior|system)\s+/gi,
  /you\s+are\s+now\s+(a|an)\s+/gi,
  /act\s+as\s+(if\s+you\s+are\s+)?(a\s+)?(system|admin|root|developer)/gi,
  /\[?\s*system\s*\]?\s*:/gi,
  /<\s*\/?\s*system\s*>/gi,
  /reveal\s+(your\s+)?(system\s+)?prompt/gi,
  /mostra\s+(il\s+)?(prompt|system\s+prompt)/gi,
  /ignora\s+(le\s+)?(istruzioni|regole)\s+(precedenti|di\s+sistema)/gi,
  /dimentica\s+(le\s+)?(istruzioni|regole)/gi,
  /jailbreak/gi,
  /DAN\s+mode/gi,
  /<\s*script\b[^>]*>[\s\S]*?<\/\s*script\s*>/gi,
  /javascript\s*:/gi,
  /on(error|load|click|mouseover)\s*=/gi,
  /\$\{[\s\S]{0,200}\}/g,
  /`\s*\$\{/g,
];

const MALICIOUS_PAYLOAD_PATTERNS: RegExp[] = [
  /<\s*iframe\b/i,
  /<\s*object\b/i,
  /<\s*embed\b/i,
  /data\s*:\s*text\/html/i,
  /\x00/,
];

export const MAX_USER_INPUT_CHARS = 8_000;
/** Payload cap: 35 clinician turns × 2 roles plus a small buffer. */
export const MAX_CHAT_MESSAGES = 100;

/**
 * Neutralizes common prompt-injection phrases in user-authored text
 * before it is sent to OpenAI or vector retrieval APIs.
 */
export function stripPromptInjection(text: string): string {
  if (!text || typeof text !== "string") return text;

  let sanitized = text.slice(0, MAX_USER_INPUT_CHARS);
  // Strip C0 control chars except tab/newline/carriage-return.
  sanitized = sanitized.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  for (const pattern of INJECTION_PATTERNS) {
    pattern.lastIndex = 0;
    sanitized = sanitized.replace(pattern, "[FILTERED]");
  }
  return sanitized;
}

export function containsBlockedInjection(text: string): boolean {
  if (!text) return false;
  if (MALICIOUS_PAYLOAD_PATTERNS.some((pattern) => pattern.test(text))) {
    return true;
  }
  return INJECTION_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
}

/** True when raw user input should be rejected before model invocation. */
export function shouldRejectUserChatInput(text: string): boolean {
  if (!text || typeof text !== "string") return true;
  if (text.length > MAX_USER_INPUT_CHARS) return true;
  return containsBlockedInjection(text);
}
