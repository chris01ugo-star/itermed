import { z } from "zod";
import { getSessionUserId, unauthorizedJson } from "@/lib/api-session";
import { verifyLiveSessionOwner } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { MEDICAL_DISCLAIMER_VERSION } from "@/lib/simulator/medical-disclaimer";
import { sanitizeLiveSessionId } from "@/lib/simulator/session-id";

export const runtime = "nodejs";

const bodySchema = z.object({
  sessionId: z.string().min(1),
  disclaimerVersion: z.string().trim().min(1).max(32).optional(),
});

/**
 * Audit trail del disclaimer iniziale per questa CaseSession.
 * La prima accettazione resta: un secondo invio non sposta il timestamp.
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

    const existing = await prisma.caseSession.findUnique({
      where: { id: liveSessionId },
      select: { disclaimerAcceptedAt: true, disclaimerVersion: true },
    });
    if (!existing) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    if (existing.disclaimerAcceptedAt) {
      return Response.json({
        disclaimerAcceptedAt: existing.disclaimerAcceptedAt.toISOString(),
        disclaimerVersion: existing.disclaimerVersion ?? MEDICAL_DISCLAIMER_VERSION,
        alreadyAccepted: true,
      });
    }

    const acceptedAt = new Date();
    const disclaimerVersion = body.disclaimerVersion?.trim() || MEDICAL_DISCLAIMER_VERSION;
    const updated = await prisma.caseSession.update({
      where: { id: liveSessionId },
      data: {
        disclaimerAcceptedAt: acceptedAt,
        disclaimerVersion,
      },
      select: { disclaimerAcceptedAt: true, disclaimerVersion: true },
    });

    return Response.json({
      disclaimerAcceptedAt: updated.disclaimerAcceptedAt?.toISOString() ?? acceptedAt.toISOString(),
      disclaimerVersion: updated.disclaimerVersion ?? disclaimerVersion,
      alreadyAccepted: false,
    });
  } catch (err) {
    console.error("[POST /api/session/accept-disclaimer]", err);
    return Response.json({ error: "Internal error", code: "DISCLAIMER_ACCEPT_FAILED" }, { status: 500 });
  }
}
