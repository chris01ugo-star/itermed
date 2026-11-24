import { sanitizeLiveSessionId } from "@/lib/simulator/session-id";

/** Best-effort ping so a bounce under 30s can be refunded after back/close. */
export function pingReleaseShortSession(sessionId: string | null | undefined): void {
  const id = sanitizeLiveSessionId(sessionId);
  if (!id || typeof fetch === "undefined") return;

  const body = JSON.stringify({ sessionId: id });
  void fetch("/api/session/release-short", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
    credentials: "same-origin",
  }).catch(() => undefined);
}
