import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { prisma } from "../../../lib/prisma";
import { getSessionUserId } from "../../../lib/api-session";
import { userCanPlayCase, verifyLiveSessionOwner } from "../../../lib/access";
import { sanitizeForExternalAI } from "@/lib/security/sanitize-for-ai";
import { AI_RATE_LIMITS } from "@/lib/security/ai-rate-limits";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { withOpenAIRetry } from "@/lib/ai/openai-retry";

const bodySchema = z.object({
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

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rateLimited = await enforceRateLimit(req, {
    namespace: "api-examine",
    limit: AI_RATE_LIMITS.examine,
    userId,
  });
  if (rateLimited) return rateLimited;

  const json = await req.json();
  const parsed = bodySchema.parse(json);
  const { sessionId, caseId, examId, examType, patientPrompt } = parsed;
  const sanitizedPatientPrompt = sanitizeForExternalAI(patientPrompt);

  if (sessionId) {
    const owns = await verifyLiveSessionOwner(sessionId, userId);
    if (!owns) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
  } else if (caseId) {
    const allowed = await userCanPlayCase(userId, caseId);
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
  } else {
    return new Response(JSON.stringify({ error: "sessionId or caseId required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 0) Se esiste una sessione con overrides (Parte 2 / Variante), usali prima di tutto
  if (sessionId && examId) {
    const session = await prisma.caseSession.findUnique({ where: { id: sessionId } });
    const overrides: any = (session as any)?.examOverrides ?? null;
    if (overrides) {
      const vitals = overrides.vitals ?? {};
      const thorax = overrides.thorax ?? {};
      const abdomen = overrides.abdomen ?? {};
      const neuro = overrides.neuro ?? {};

      let finding: string | null = null;
      let numericValue: number | null = null;

      switch (examId) {
        case "heart-rate": {
          const v = vitals.heartRate;
          if (v != null) {
            numericValue = typeof v === "number" ? v : numericValue;
            finding = typeof v === "number" ? `Frequenza cardiaca ${v} bpm` : String(v);
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
            numericValue = typeof v === "number" ? v : numericValue;
            finding = typeof v === "number" ? `SpO₂ ${v}%` : String(v);
          }
          break;
        }
        case "temperature": {
          const v = vitals.temperature;
          if (v != null) {
            numericValue = typeof v === "number" ? v : numericValue;
            finding = typeof v === "number" ? `Temperatura ${v} °C` : String(v);
          }
          break;
        }
        case "resp-rate": {
          const v = vitals.respiratoryRate;
          if (v != null) {
            numericValue = typeof v === "number" ? v : numericValue;
            finding = typeof v === "number" ? `Frequenza respiratoria ${v} atti/min` : String(v);
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
      }

      if (finding != null) {
        return new Response(JSON.stringify({ finding, numericValue }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
  }

  // 1) Se esistono valori manuali nel caso, usali direttamente
  if (caseId && examId) {
    const clinicalCase = await prisma.clinicalCase.findUnique({
      where: { id: caseId },
    });

    const baseline: any = (clinicalCase as any)?.baselineExamFindings ?? {};
    const vitals = baseline.vitals ?? {};
    const thorax = baseline.thorax ?? {};
    const abdomen = baseline.abdomen ?? {};
    const neuro = baseline.neuro ?? {};

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
        if (v != null) {
          finding = String(v);
        }
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
        if (v != null) {
          finding = String(v);
        }
        break;
      }
      case "lung-auscultation": {
        const v = thorax.lungAuscultation;
        if (v != null) {
          finding = String(v);
        }
        break;
      }
      case "abdomen-inspection": {
        const v = abdomen.inspection;
        if (v != null) {
          finding = String(v);
        }
        break;
      }
      case "abdomen-palpation": {
        const v = abdomen.palpation;
        if (v != null) {
          finding = String(v);
        }
        break;
      }
      case "abdomen-percussion": {
        const v = abdomen.percussion;
        if (v != null) {
          finding = String(v);
        }
        break;
      }
      case "pupils": {
        const v = neuro.pupils;
        if (v != null) {
          finding = String(v);
        }
        break;
      }
      case "gcs": {
        const v = neuro.gcs;
        if (v != null) {
          finding = String(v);
        }
        break;
      }
      case "neuro-deficits": {
        const v = neuro.deficits;
        if (v != null) {
          finding = String(v);
        }
        break;
      }
    }

    if (finding != null) {
      return new Response(
        JSON.stringify({
          finding,
          numericValue,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
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

