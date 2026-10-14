import { sanitizeLiveSessionId } from "@/lib/simulator/session-id";

/**
 * In-progress CaseSession id for the open play tab.
 * React state on SimulatorClient is wiped when the client remounts (the play
 * page updates `?sessionId=` via history.replaceState, so the RSC prop stays
 * empty). This pin survives that remount for the lifetime of the tab.
 */
const memoryPins = new Map<string, string>();

function storageKey(caseId: string): string {
  return `aequan:live-session:${caseId}`;
}

/**
 * Session-storage pin only. In the browser an empty key wins over the
 * in-memory mirror, so a cleared pin cannot be resurrected after remount.
 * The mirror is used when `sessionStorage` is unavailable (SSR, private mode).
 */
export function readLiveSessionIdFromSessionStorage(caseId: string): string | undefined {
  const key = caseId.trim();
  if (!key) return undefined;

  if (typeof window === "undefined") {
    return sanitizeLiveSessionId(memoryPins.get(key));
  }

  try {
    const stored = sanitizeLiveSessionId(window.sessionStorage.getItem(storageKey(key)));
    if (stored) {
      memoryPins.set(key, stored);
      return stored;
    }
    memoryPins.delete(key);
    return undefined;
  } catch {
    return sanitizeLiveSessionId(memoryPins.get(key));
  }
}

export function readPinnedLiveSessionId(caseId: string): string | undefined {
  return readLiveSessionIdFromSessionStorage(caseId);
}

export function readLiveSessionIdFromLocation(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return sanitizeLiveSessionId(new URL(window.location.href).searchParams.get("sessionId"));
  } catch {
    return undefined;
  }
}

/** Remember a live CaseSession id. Offline/registry tokens are ignored. */
export function pinLiveSessionId(
  caseId: string,
  sessionId: string | null | undefined,
): string | undefined {
  const key = caseId.trim();
  const id = sanitizeLiveSessionId(sessionId);
  if (!key || !id) return undefined;

  memoryPins.set(key, id);
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(storageKey(key), id);
    } catch {
      /* private mode or blocked storage — memory pin still holds the id */
    }
  }
  return id;
}

export function clearPinnedLiveSessionId(caseId: string): void {
  const key = caseId.trim();
  if (!key) return;
  memoryPins.delete(key);
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(storageKey(key));
  } catch {
    /* ignore */
  }
}

/**
 * Click-time lookup. Empty values are skipped and never overwrite a later hit.
 * 1. React ref  2. sessionStorage  3. `?sessionId=`
 */
export function resolveAnchoredLiveSessionId(
  caseId: string,
  refValue?: string | null,
): string | undefined {
  return (
    sanitizeLiveSessionId(refValue) ??
    readLiveSessionIdFromSessionStorage(caseId) ??
    readLiveSessionIdFromLocation()
  );
}

/**
 * First non-empty explicit candidate, then sessionStorage, then the address bar.
 * Undefined/null/"" candidates are ignored — they must not clear a known id.
 */
export function resolvePersistedLiveSessionId(
  caseId: string,
  ...candidates: Array<string | null | undefined>
): string | undefined {
  for (const candidate of candidates) {
    const id = sanitizeLiveSessionId(candidate);
    if (id) return id;
  }
  return readLiveSessionIdFromSessionStorage(caseId) ?? readLiveSessionIdFromLocation();
}
