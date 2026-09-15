import { z } from "zod";
import { getSessionUserId, unauthorizedJson } from "@/lib/api-session";
import { authorizeOwnedLiveSession } from "@/lib/access";
import { PrescribeMedicationBodySchema } from "@/lib/medications/medication-schemas";
import { recordSessionPrescription } from "@/lib/simulator/record-session-prescription";
import { sanitizeLiveSessionId } from "@/lib/simulator/session-id";

export const runtime = "nodejs";

/**
 * Ricettario: persist structured prescription into CaseSession state + chronological chat log.
 */
export async function POST(req: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return unauthorizedJson();

    let body: z.infer<typeof PrescribeMedicationBodySchema>;
    try {
      body = PrescribeMedicationBodySchema.parse(await req.json());
    } catch {
      return Response.json({ error: "Invalid body" }, { status: 400 });
    }

    const liveSessionId = sanitizeLiveSessionId(body.sessionId);
    if (!liveSessionId) {
      return Response.json({ error: "Forbidden", code: "FORBIDDEN_SESSION" }, { status: 403 });
    }

    const access = await authorizeOwnedLiveSession({
      userId,
      sessionId: liveSessionId,
      expectedCaseId: body.caseId,
    });
    if (!access.ok) {
      return Response.json({ error: access.error, code: access.code }, { status: access.status });
    }

    const result = await recordSessionPrescription({
      sessionId: access.liveSessionId,
      medicationId: body.medicationId,
      route: body.route,
      posology: body.posology,
    });

    return Response.json({ ok: true, ...result });
  } catch (err) {
    const status = typeof (err as { status?: number })?.status === "number"
      ? (err as { status: number }).status
      : 500;
    if (status === 404) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }
    console.error("[POST /api/session/prescribe]", err);
    return Response.json({ error: "Internal error", code: "PRESCRIBE_FAILED" }, { status: 500 });
  }
}
