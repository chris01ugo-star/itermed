/**
 * Prompt-context fencing & truncation helpers (OWASP LLM01 / token containment).
 */

/** Soft cap for combined RAG text passed to gpt-4o evaluation (~6–8k chars). */
export const RAG_COMBINED_TEXT_MAX_CHARS = 7000;

/** Fence untrusted / retrieved content outside the system prompt. */
export function fenceContext(tag: string, body: string): string {
  const safe = (body ?? "").trim() || "N/D";
  return `<<<${tag}>>>\n${safe}\n<<<END_${tag}>>>`;
}

/**
 * Truncates long RAG / guideline blobs at a clean boundary to contain input tokens.
 */
export function truncateForLlmContext(
  text: string,
  maxChars: number = RAG_COMBINED_TEXT_MAX_CHARS,
): string {
  const normalized = (text ?? "").trim();
  if (normalized.length <= maxChars) return normalized;

  const slice = normalized.slice(0, maxChars);
  const lastNewline = slice.lastIndexOf("\n");
  const lastPeriod = slice.lastIndexOf(". ");
  const breakAt = Math.max(lastNewline, lastPeriod > 0 ? lastPeriod + 1 : -1);
  const cut =
    breakAt > maxChars * 0.55 ? slice.slice(0, breakAt).trimEnd() : slice.trimEnd();

  return `${cut}\n\n[...contesto troncato per limite token di input...]`;
}
