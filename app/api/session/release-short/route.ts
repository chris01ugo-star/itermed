import { z } from "zod";
import { getSessionUserId, unauthorizedJson } from "@/lib/api-session";
import { releaseShortLivedSession } from "@/lib/billing/session-credits";
import { sanitizeLiveSessionId } from "@/lib/simulator/session-id";

export const runtime = "nodejs";

const bodySchema = z.object({
  sessionId: z.string().min(1),
});

/**
 * Idempotent: refund + drop a live session that lasted under 30 seconds.
 * Used on back/leave/close so accidental opens are not counted as used.
 */
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorizedJson();

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const sessionId = sanitizeLiveSessionId(parsed.data.sessionId);
  if (!sessionId) {
    return Response.json({ released: false, reason: "invalid" });
  }

  const result = await releaseShortLivedSession({ userId, sessionId });
  return Response.json(result);
}
