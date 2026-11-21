/** Compact dialogue for audit prompts. Drops role metadata the model does not need. */
export function formatAuditChatTranscript(
  chat: Array<{ role?: string | null; content?: string | null }> | null | undefined,
): string {
  if (!Array.isArray(chat) || chat.length === 0) return "(nessun dialogo)";
  const lines: string[] = [];
  for (const turn of chat) {
    const content = typeof turn?.content === "string" ? turn.content.trim() : "";
    if (!content) continue;
    const label =
      turn.role === "assistant" ? "PAZIENTE" : turn.role === "user" ? "MEDICO" : "ALTRO";
    lines.push(`[${label}]: ${content}`);
  }
  return lines.length > 0 ? lines.join("\n") : "(nessun dialogo)";
}
