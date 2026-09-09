import { z } from "zod";
import { getSessionUserId, unauthorizedJson } from "@/lib/api-session";
import { verifyLiveSessionOwner } from "@/lib/access";
import { recordConsentInformedRequest } from "@/lib/simulator/milestone-tracker";
import { sanitizeLiveSessionId } from "@/lib/simulator/session-id";

export const runtime = "nodejs";

const bodySchema = z.object({
  sessionId: z.string().min(1),
});

/**
 * User-initiated informed consent module — logs milestone + action id for evaluation.
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

    const liveSessionId = sanitizeLiveSessionId(body.sessionId);
    if (!liveSessionId) {
      return Response.json({ error: "Forbidden", code: "FORBIDDEN_SESSION" }, { status: 403 });
    }

    const owns = await verifyLiveSessionOwner(liveSessionId, userId);
    if (!owns) {
      return Response.json({ error: "Forbidden", code: "FORBIDDEN_SESSION" }, { status: 403 });
    }

    const result = await recordConsentInformedRequest({ sessionId: liveSessionId });
    return Response.json(result);
  } catch (err) {
    console.error("[POST /api/session/consent]", err);
    return Response.json({ error: "Internal error", code: "CONSENT_FAILED" }, { status: 500 });
  }
}
