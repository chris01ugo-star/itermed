import { z } from "zod";
import { getSessionUserId, unauthorizedJson } from "@/lib/api-session";
import { verifyLiveSessionOwner } from "@/lib/access";
import { recordHelpRequest } from "@/lib/simulator/milestone-tracker";
import { sanitizeLiveSessionId } from "@/lib/simulator/session-id";

export const runtime = "nodejs";

const bodySchema = z.object({
  sessionId: z.string().min(1),
  helpRequestCount: z.number().int().min(1).max(500).default(1),
});

/**
 * User-initiated help / consult request — telemetry for clinical autonomy.
 * Does not pause or alter the simulation flow.
 */
export async function POST(req: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return unauthorizedJson();

    let body: z.infer<typeof bodySchema>;
    try {
      body = bodySchema.parse(await req.json());
    } catch {
      return Response.json({ error: "Invalid body" }, { status: 400 });
    }

    const helpRequestCount = Math.max(1, Math.floor(body.helpRequestCount) || 1);

    const liveSessionId = sanitizeLiveSessionId(body.sessionId);
    if (!liveSessionId) {
      return Response.json({ error: "Forbidden", code: "FORBIDDEN_SESSION" }, { status: 403 });
    }

    const owns = await verifyLiveSessionOwner(liveSessionId, userId);
    if (!owns) {
      return Response.json({ error: "Forbidden", code: "FORBIDDEN_SESSION" }, { status: 403 });
    }

    const result = await recordHelpRequest({
      sessionId: liveSessionId,
      helpRequestCount,
    });

    return Response.json(result);
  } catch (err) {
    console.error("[POST /api/session/help]", err);
    return Response.json({ error: "Internal error", code: "HELP_FAILED" }, { status: 500 });
  }
}
