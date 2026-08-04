import { z } from "zod";
import { getSessionUserId } from "@/lib/api-session";
import { verifyLiveSessionOwner } from "@/lib/access";
import { recordHelpRequest } from "@/lib/simulator/milestone-tracker";
import { isOfflineSessionId, sanitizeLiveSessionId } from "@/lib/simulator/session-id";

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
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: z.infer<typeof bodySchema>;
    try {
      body = bodySchema.parse(await req.json());
    } catch {
      return Response.json({ error: "Invalid body" }, { status: 400 });
    }

    const helpRequestCount = Math.max(1, Math.floor(body.helpRequestCount) || 1);

    // Offline / registry sessions: acknowledge without Prisma FK writes.
    if (isOfflineSessionId(body.sessionId)) {
      return Response.json({
        helpRequested: true,
        helpRequestCount,
        offline: true,
      });
    }

    const liveSessionId = sanitizeLiveSessionId(body.sessionId);
    if (!liveSessionId) {
      return Response.json({ error: "Invalid sessionId" }, { status: 400 });
    }

    const owns = await verifyLiveSessionOwner(liveSessionId, userId);
    if (!owns) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await recordHelpRequest({
      sessionId: liveSessionId,
      helpRequestCount,
    });

    return Response.json(result);
  } catch (err) {
    console.error("[POST /api/session/help]", err);
    // Never block the simulation UI for telemetry failures.
    return Response.json(
      {
        helpRequested: true,
        helpRequestCount: 1,
        warning: "Telemetry write failed",
      },
      { status: 200 },
    );
  }
}
