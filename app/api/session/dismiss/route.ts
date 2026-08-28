import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import { getSessionUserId, unauthorizedJson } from "../../../../lib/api-session";
import { userCanPlayCase, verifyLiveSessionOwner } from "../../../../lib/access";

const bodySchema = z.object({
  caseId: z.string().min(1),
  liveSessionId: z.string().optional(),
});

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

  const { caseId, liveSessionId } = parsed.data;

  const allowed = await userCanPlayCase(userId, caseId);
  if (!allowed) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  if (liveSessionId) {
    const owns = await verifyLiveSessionOwner(liveSessionId, userId);
    if (!owns) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    const live = await prisma.caseSession.findUnique({
      where: { id: liveSessionId },
      select: { caseId: true },
    });
    if (live && live.caseId !== caseId) {
      return Response.json({ error: "Session mismatch" }, { status: 400 });
    }
  }

  const feedback = {
    strengths: [] as string[],
    weaknesses: ["Simulazione interrotta dall'utente prima del completamento."],
    clinicalNote:
      "Caso abbandonato: nessuna valutazione clinica applicata. Punteggio registrato come 0.",
    legalComplianceNote:
      "Caso abbandonato: nessuna valutazione medico-legale applicata. Punteggio registrato come 0.",
    prescribingNote:
      "Caso abbandonato: nessuna valutazione sull'appropriatezza prescrittiva. Punteggio registrato come 0.",
    empathyNote:
      "Caso abbandonato: nessuna valutazione sull'empatia. Punteggio registrato come 0.",
    economyNote:
      "Caso abbandonato: nessuna valutazione economica. Punteggio registrato come 0.",
    correctSolution: "",
  };

  const report = await prisma.sessionReport.create({
    data: {
      userId,
      caseId,
      clinicalAccuracy: 0,
      legalComplianceGelliBianco: 0,
      prescribingAppropriateness: 0,
      economicSustainability: 0,
      empathy: 0,
      totalScore: 0,
      status: "COMPLETED",
      progress: 100,
      progressMessage: "Report pronto!",
      completedAt: new Date(),
      notes:
        "Caso abbandonato dall'utente (Dismiss case): tutti i punteggi registrati a 0 per policy IterMed.",
      rawTrace: {
        dismissed: true,
        liveSessionId: liveSessionId ?? null,
        chatHistory: [],
        exams: [],
        reportText: "",
        feedback,
        evidence: { legalSources: [], protocolSources: [] },
      },
    },
  });

  return Response.json({ sessionId: report.id });
}
