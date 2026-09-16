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
import { extractCanonicalVitalsJson, formatBloodPressureFinding } from "@/lib/clinical/case-vitals";
import {
  formatClinicalSignFinding,
  isClinicalSignExamId,
  matchClinicalSign,
  NEGATIVE_SEMEIOTIC_FINDING,
  parseClinicalSigns,
} from "@/lib/clinical/clinical-signs";
import {
  derivePhysicalExamFromSummary,
  type KillipClass,
} from "@/lib/clinical/physical-exam-from-summary";

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

function asFindingText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function asNumeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value.replace(",", ".").replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function vitalNumericFinding(
  value: unknown,
  label: string,
  unit: string,
): { finding: string; numericValue: number | null } | null {
  if (value == null || value === "") return null;
  const numericValue = asNumeric(value);
  if (numericValue != null) {
    return { finding: `${label} ${numericValue}${unit}`, numericValue };
  }
  const text = String(value).trim();
  return text ? { finding: text, numericValue: null } : null;
}

function districtFinding(
  physical: Record<string, unknown>,
  district: string,
): string | null {
  const raw = physical.districts;
  if (!Array.isArray(raw)) return null;
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    if (String(row.district ?? "") !== district) continue;
    return asFindingText(row.finding);
  }
  return null;
}

function findingFromClinicalSigns(
  baseline: Record<string, unknown> | null | undefined,
  examId: string,
  examLabel?: string,
): { finding: string; numericValue: number | null } | null {
  const signs = parseClinicalSigns(baseline);
  const matched = matchClinicalSign(signs, { id: examId, label: examLabel });
  if (matched) {
    return { finding: formatClinicalSignFinding(matched), numericValue: null };
  }
  if (isClinicalSignExamId(examId)) {
    return { finding: NEGATIVE_SEMEIOTIC_FINDING, numericValue: null };
  }
  return null;
}

function findingFromBaseline(
  baseline: Record<string, unknown> | null | undefined,
  examId: string,
  examLabel?: string,
): { finding: string; numericValue: number | null } | null {
  if (!baseline || typeof baseline !== "object") return null;
  const fromSign = findingFromClinicalSigns(baseline, examId, examLabel);
  if (fromSign) return fromSign;
  const canonical = extractCanonicalVitalsJson(baseline);
  const thorax = (baseline.thorax ?? {}) as Record<string, unknown>;
  const abdomen = (baseline.abdomen ?? {}) as Record<string, unknown>;
  const neuro = (baseline.neuro ?? {}) as Record<string, unknown>;
  const physical = (baseline.physicalExam ?? {}) as Record<string, unknown>;
  const peripheral = (baseline.peripheral ?? {}) as Record<string, unknown>;
  const killipRaw = physical.killipClass;
  const derived = derivePhysicalExamFromSummary({
    summary:
      asFindingText(physical.summary) ?? asFindingText(physical.finding),
    killipClass:
      killipRaw === "I" || killipRaw === "II" || killipRaw === "III" || killipRaw === "IV"
        ? (killipRaw as KillipClass)
        : null,
    heartRate: asNumeric(canonical?.heartRate),
  });

  let finding: string | null = null;
  let numericValue: number | null = null;

  switch (examId) {
    case "heart-rate": {
      const parsed = vitalNumericFinding(canonical?.heartRate, "Frequenza cardiaca", " bpm");
      if (parsed) {
        finding = parsed.finding;
        numericValue = parsed.numericValue;
      }
      break;
    }
    case "blood-pressure": {
      const fromHelper = formatBloodPressureFinding(baseline);
      if (fromHelper) {
        finding = fromHelper.finding;
        numericValue = fromHelper.numericValue;
      }
      break;
    }
    case "spo2": {
      const parsed = vitalNumericFinding(canonical?.spo2, "SpO₂", "%");
      if (parsed) {
        finding = parsed.finding;
        numericValue = parsed.numericValue;
      }
      break;
    }
    case "temperature": {
      const parsed = vitalNumericFinding(canonical?.temperature, "Temperatura", " °C");
      if (parsed) {
        finding = parsed.finding;
        numericValue = parsed.numericValue;
      }
      break;
    }
    case "resp-rate": {
      const parsed = vitalNumericFinding(
        canonical?.respiratoryRate,
        "Frequenza respiratoria",
        " atti/min",
      );
      if (parsed) {
        finding = parsed.finding;
        numericValue = parsed.numericValue;
      }
      break;
    }
    case "cardiac-auscultation": {
      finding =
        asFindingText(thorax.cardiacAuscultation) ??
        districtFinding(physical, "cardiovascolare") ??
        derived.cardiovascolare;
      if (finding && finding === districtFinding(physical, "generale")) {
        finding = derived.cardiovascolare;
      }
      break;
    }
    case "lung-auscultation": {
      finding =
        asFindingText(thorax.lungAuscultation) ??
        districtFinding(physical, "torace_polmonare") ??
        derived.torace;
      if (finding && finding === districtFinding(physical, "generale")) {
        finding = derived.torace;
      }
      break;
    }
    case "abdomen-inspection": {
      finding =
        asFindingText(abdomen.inspection) ??
        districtFinding(physical, "addome") ??
        derived.addomeInspection;
      break;
    }
    case "abdomen-palpation": {
      finding =
        asFindingText(abdomen.palpation) ??
        districtFinding(physical, "addome") ??
        derived.addomePalpation;
      break;
    }
    case "abdomen-percussion": {
      finding =
        asFindingText(abdomen.percussion) ??
        districtFinding(physical, "addome") ??
        derived.addomePercussion;
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
    case "general-appearance": {
      const raw =
        districtFinding(physical, "generale") ??
        asFindingText(physical.generalAppearance) ??
        asFindingText(physical.finding) ??
        asFindingText(physical.summary);
      finding =
        raw && raw !== derived.addomePalpation && raw !== derived.torace
          ? raw
          : derived.generale;
      break;
    }
    case "skin-mucosa": {
      // Prefer dedicated skin fields; never fall back to the shared general summary
      // (that made Generale / Cute / CV return the same text).
      finding =
        asFindingText(physical.skinMucosa) ??
        asFindingText(physical.skin) ??
        asFindingText(physical.mucosa) ??
        asFindingText(peripheral.skin) ??
        asFindingText(peripheral.skinMucosa);
      break;
    }
    case "cardiovascular": {
      const general = districtFinding(physical, "generale");
      const cardioDistrict = districtFinding(physical, "cardiovascolare");
      const distinctCardio =
        cardioDistrict && cardioDistrict !== general ? cardioDistrict : null;
      const murmur = asFindingText(physical.aorticDiastolicMurmur);
      const leftPulse = asFindingText(physical.leftRadialPulse);
      const composedBits = [murmur, leftPulse].filter(Boolean);
      const composed =
        composedBits.length > 0
          ? [
              murmur ? `Soffio: ${murmur}` : null,
              leftPulse ? `Polso radiale sx: ${leftPulse}` : null,
            ]
              .filter(Boolean)
              .join(". ")
          : null;

      finding =
        distinctCardio ??
        asFindingText(peripheral.finding) ??
        composed ??
        asFindingText(physical.cardiovascular) ??
        derived.cardiovascolare;
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
    const fromOverrides = findingFromBaseline(overrides, examId, examType);
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

    const fromBaseline = findingFromBaseline(baseline, examId, examType);
    if (fromBaseline) {
      return new Response(JSON.stringify(fromBaseline), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  if (examId && isClinicalSignExamId(examId)) {
    return new Response(
      JSON.stringify({
        finding: NEGATIVE_SEMEIOTIC_FINDING,
        numericValue: null,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // Vital signs must never be invented by the LLM — only baseline JSON.
  if (
    examId === "blood-pressure" ||
    examId === "heart-rate" ||
    examId === "spo2" ||
    examId === "temperature" ||
    examId === "resp-rate"
  ) {
    return new Response(
      JSON.stringify({
        finding: "Parametro vitale non disponibile nel caso",
        numericValue: null,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  const systemPrompt = `
Sei il corpo del paziente descritto nel prompt seguente. Non sei un medico e non devi formulare diagnosi.
Il medico sta eseguendo SOLO questa manovra di esame obiettivo: "${examType}" (id: ${examId ?? "n/d"}).
Descrivi esclusivamente i reperti rilevabili con QUESTA manovra — non ripetere un esame obiettivo generale completo se la manovra è distrettuale (cute, cardiovascolare, ecc.).
Devi restituire SOLO un JSON con i campi:
- "finding": descrizione testuale breve e realistica del reperto (massimo 20 parole, in italiano).
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

