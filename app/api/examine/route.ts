import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { prisma } from "../../../lib/prisma";
import { requireUserApi, isUnauthorizedResponse } from "../../../lib/api-session";
import { authorizeSimulationAction } from "../../../lib/access";
import { sanitizeForExternalAI } from "@/lib/security/sanitize-for-ai";
import { AI_RATE_LIMITS } from "@/lib/security/ai-rate-limits";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { withOpenAIRetry } from "@/lib/ai/openai-retry";
import { getCaseById, normalizeCaseLookupKey } from "@/lib/data/cases/registry";

const bodySchema = z.object({
  /** Optional: live Prisma session. Offline `registry_*` tokens are ignored. */
  sessionId: z.string().optional(),
  caseId: z.string().optional(),
  examId: z.string().optional(),
  examType: z.string().min(1),
  patientPrompt: z.string().min(1),
});

const examResultSchema = z.object({
  finding: z.string(),
  numericValue: z.number().nullable(),
});

function findingFromBaseline(
  baseline: Record<string, unknown> | null | undefined,
  examId: string,
): { finding: string; numericValue: number | null } | null {
  if (!baseline || typeof baseline !== "object") return null;
  const vitals = (baseline.vitals ?? {}) as Record<string, unknown>;
  const thorax = (baseline.thorax ?? {}) as Record<string, unknown>;
  const abdomen = (baseline.abdomen ?? {}) as Record<string, unknown>;
  const neuro = (baseline.neuro ?? {}) as Record<string, unknown>;

  let finding: string | null = null;
  let numericValue: number | null = null;

  switch (examId) {
    case "heart-rate": {
      const v = vitals.heartRate;
      if (v != null) {
        if (typeof v === "number") {
          numericValue = v;
          finding = `Frequenza cardiaca ${v} bpm`;
        } else {
          finding = String(v);
        }
      }
      break;
    }
    case "blood-pressure": {
      const v = vitals.bloodPressure;
      if (v != null) finding = String(v);
      break;
    }
    case "spo2": {
      const v = vitals.spo2;
      if (v != null) {
        if (typeof v === "number") {
          numericValue = v;
          finding = `SpO₂ ${v}%`;
        } else {
          finding = String(v);
        }
      }
      break;
    }
    case "temperature": {
      const v = vitals.temperature;
      if (v != null) {
        if (typeof v === "number") {
          numericValue = v;
          finding = `Temperatura ${v} °C`;
        } else {
          finding = String(v);
        }
      }
      break;
    }
    case "resp-rate": {
      const v = vitals.respiratoryRate;
      if (v != null) {
        if (typeof v === "number") {
          numericValue = v;
          finding = `Frequenza respiratoria ${v} atti/min`;
        } else {
          finding = String(v);
        }
      }
      break;
    }
    case "cardiac-auscultation": {
      const v = thorax.cardiacAuscultation;
      if (v != null) finding = String(v);
      break;
    }
    case "lung-auscultation": {
      const v = thorax.lungAuscultation;
      if (v != null) finding = String(v);
      break;
    }
    case "abdomen-inspection": {
      const v = abdomen.inspection;
      if (v != null) finding = String(v);
      break;
    }
    case "abdomen-palpation": {
      const v = abdomen.palpation;
      if (v != null) finding = String(v);
      break;
    }
    case "abdomen-percussion": {
      const v = abdomen.percussion;
      if (v != null) finding = String(v);
      break;
    }
    case "pupils": {
      const v = neuro.pupils;
      if (v != null) finding = String(v);
      break;
    }
    case "gcs": {
      const v = neuro.gcs;
      if (v != null) finding = String(v);
      break;
    }
    case "neuro-deficits": {
      const v = neuro.deficits;
      if (v != null) finding = String(v);
      break;
    }
    case "general-appearance":
    case "skin-mucosa":
    case "cardiovascular": {
      const physical = (baseline.physicalExam ?? {}) as Record<string, unknown>;
      const peripheral = (baseline.peripheral ?? {}) as Record<string, unknown>;
      if (examId === "cardiovascular" && peripheral.finding != null) {
        finding = String(peripheral.finding);
      } else if (physical.finding != null) {
        finding = String(physical.finding);
      } else if (peripheral.finding != null) {
        finding = String(peripheral.finding);
      }
      break;
    }
  }

  return finding != null ? { finding, numericValue } : null;
}

export async function POST(req: Request) {
  const auth = await requireUserApi();
  if (isUnauthorizedResponse(auth)) return auth;
  const userId = auth.id;

  const rateLimited = await enforceRateLimit(req, {
    namespace: "api-examine",
    limit: AI_RATE_LIMITS.examine,
    userId,
  });
  if (rateLimited) return rateLimited;

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return new Response(JSON.stringify({ error: "Invalid body", code: "INVALID_BODY" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { sessionId, caseId, examId, examType, patientPrompt } = parsed;
  const sanitizedPatientPrompt = sanitizeForExternalAI(patientPrompt);

  // Soft-allow authenticated play: live session when available, otherwise caseId
  // (registry/offline tokens are ignored by authorizeSimulationAction).
  const access = await authorizeSimulationAction({
    userId,
    sessionId,
    caseId,
  });
  if (!access.ok) {
    return new Response(JSON.stringify({ error: access.error, code: access.code }), {
      status: access.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const liveSessionId = access.liveSessionId;
  const resolvedCaseId = access.caseId ?? caseId;

  if (!resolvedCaseId && !sanitizedPatientPrompt.trim()) {
    return new Response(
      JSON.stringify({
        error: "caseId or patientPrompt required",
        code: "EXAMINE_CONTEXT_REQUIRED",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // 0) Se esiste una sessione con overrides (Parte 2 / Variante), usali prima di tutto
  if (liveSessionId && examId) {
    const session = await prisma.caseSession.findUnique({ where: { id: liveSessionId } });
    const overrides = (session as { examOverrides?: Record<string, unknown> } | null)
      ?.examOverrides;
    const fromOverrides = findingFromBaseline(overrides, examId);
    if (fromOverrides) {
      return new Response(JSON.stringify(fromOverrides), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // 1) Baseline caso (DB o registry gold-standard)
  if (resolvedCaseId && examId) {
    const caseKey = normalizeCaseLookupKey(resolvedCaseId);
    let baseline: Record<string, unknown> | null = null;

    try {
      const clinicalCase = await prisma.clinicalCase.findFirst({
        where: { OR: [{ id: resolvedCaseId }, { id: caseKey }] },
        select: { baselineExamFindings: true },
      });
      if (clinicalCase?.baselineExamFindings && typeof clinicalCase.baselineExamFindings === "object") {
        baseline = clinicalCase.baselineExamFindings as Record<string, unknown>;
      }
    } catch {
      baseline = null;
    }

    if (!baseline) {
      const registered = await getCaseById(resolvedCaseId);
      if (registered?.baselineExamFindings) {
        baseline = registered.baselineExamFindings as Record<string, unknown>;
      }
    }

    const fromBaseline = findingFromBaseline(baseline, examId);
    if (fromBaseline) {
      return new Response(JSON.stringify(fromBaseline), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  const systemPrompt = `
Sei il corpo del paziente descritto nel prompt seguente. Non sei un medico e non devi formulare diagnosi.
Il medico sta eseguendo la manovra di esame obiettivo: "${examType}".
Devi restituire SOLO un JSON con i campi:
- "finding": descrizione testuale breve e realistica del reperto (massimo 15 parole, in italiano).
- "numericValue": se la manovra corrisponde a un parametro vitale (es. BPM, pressione arteriosa, temperatura, frequenza respiratoria, SpO2) restituisci il numero esatto; altrimenti usa null.
`.trim();

  const { object } = await withOpenAIRetry(() =>
    generateObject({
      model: openai("gpt-4o-mini"),
      system: systemPrompt,
      schema: examResultSchema,
      prompt: `
Contesto clinico/paziente:
${sanitizedPatientPrompt}
`.trim(),
    }),
  );

  return new Response(JSON.stringify(object), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

