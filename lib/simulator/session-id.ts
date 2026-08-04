/**
 * Live CaseSession ids from Prisma vs offline / registry tokens.
 * Offline tokens must never be sent to Prisma FK paths.
 */

export function isOfflineSessionId(sessionId: string | null | undefined): boolean {
  if (typeof sessionId !== "string") return false;
  const id = sessionId.trim();
  return id.startsWith("registry_");
}

/** Returns a usable live session id, or undefined for offline/empty tokens. */
export function sanitizeLiveSessionId(
  sessionId: string | null | undefined,
): string | undefined {
  if (typeof sessionId !== "string") return undefined;
  const id = sessionId.trim();
  if (!id || isOfflineSessionId(id)) return undefined;
  return id;
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : String(item ?? "").trim()))
    .filter(Boolean);
}
