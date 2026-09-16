import type { PatientSimulatorCaseInput } from "./patient-system-prompt";
import { resolvePatientGrammaticalGender } from "@/lib/simulator/patient-grammatical-gender";
import { serializeCanonicalVitalsJson } from "@/lib/clinical/case-vitals";
import { serializeClinicalSignsJson } from "@/lib/clinical/clinical-signs";

type BaselineFindings = Record<string, unknown>;
type BodyInput = Record<string, unknown>;

function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function firstNonEmpty(...values: unknown[]): string {
  for (const v of values) {
    const s = str(v);
    if (s) return s;
  }
  return "";
}

/** Formatta i parametri vitali dal JSON `baselineExamFindings.vitals` (stesso oggetto iniettato nel prompt). */
export function formatVitalSignsFromBaseline(baseline: Record<string, unknown> | null | undefined): string {
  return serializeCanonicalVitalsJson(baseline);
}

/** Contesto clinico interno (obiettivo, esami preset) per il prompt — non va mostrato al medico in UI. */
export function formatAbnormalExamsFromBaseline(baseline: Record<string, unknown> | null | undefined): string {
  if (!baseline || typeof baseline !== "object") return "";
  const chunks: string[] = [];

  const thorax = baseline.thorax as Record<string, unknown> | undefined;
  if (thorax && Object.keys(thorax).length) {
    chunks.push(`Esame obiettivo torace: ${JSON.stringify(thorax)}`);
  }
  const abdomen = baseline.abdomen as Record<string, unknown> | undefined;
  if (abdomen && Object.keys(abdomen).length) {
    chunks.push(`Esame obiettivo addome: ${JSON.stringify(abdomen)}`);
  }
  const neuro = baseline.neuro as Record<string, unknown> | undefined;
  if (neuro && Object.keys(neuro).length) {
    chunks.push(`Esame obiettivo neuro: ${JSON.stringify(neuro)}`);
  }

  const adv = baseline.advancedExams as { notes?: string; values?: Record<string, unknown> } | undefined;
  if (adv?.notes && str(adv.notes)) chunks.push(`Note esami: ${str(adv.notes)}`);
  if (adv?.values && typeof adv.values === "object" && Object.keys(adv.values).length) {
    chunks.push(`Valori esami di laboratorio/strumentali (preset caso): ${JSON.stringify(adv.values)}`);
  }

  return chunks.join("\n");
}

function asNrs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const n = Math.round(value);
    return n >= 0 && n <= 10 ? n : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    const slash = trimmed.match(/^(\d{1,2})\s*\/\s*10$/);
    if (slash) {
      const n = Number(slash[1]);
      return n >= 0 && n <= 10 ? n : null;
    }
    if (/^\d{1,2}(?:\.0+)?$/.test(trimmed)) {
      const n = Math.round(Number(trimmed));
      return n >= 0 && n <= 10 ? n : null;
    }
  }
  return null;
}

function scanNrsInText(text: string): number | null {
  const labeled = text.match(/\b(?:nrs|vas)\s*[:=]?\s*(\d{1,2})\b/i);
  if (labeled) {
    const n = Number(labeled[1]);
    if (n >= 0 && n <= 10) return n;
  }
  const slash = text.match(/\b(\d{1,2})\s*\/\s*10\b/);
  if (slash) {
    const n = Number(slash[1]);
    if (n >= 0 && n <= 10) return n;
  }
  return null;
}

/** NRS 0–10 from baseline pain/vitals/symptoms, or from free-text (chief complaint). */
export function parsePainNrs(
  baseline: Record<string, unknown> | null | undefined,
  extraText?: string,
): number | null {
  if (baseline && typeof baseline === "object") {
    const pain =
      baseline.pain && typeof baseline.pain === "object"
        ? (baseline.pain as Record<string, unknown>)
        : undefined;
    const vitals =
      baseline.vitals && typeof baseline.vitals === "object"
        ? (baseline.vitals as Record<string, unknown>)
        : undefined;
    const symptoms =
      baseline.symptoms && typeof baseline.symptoms === "object"
        ? (baseline.symptoms as Record<string, unknown>)
        : undefined;

    const candidates = [
      pain?.nrs,
      pain?.NRS,
      pain?.score,
      pain?.intensity,
      pain?.vas,
      vitals?.nrs,
      vitals?.painScore,
      vitals?.painNrs,
      vitals?.pain,
      symptoms?.nrs,
      symptoms?.painScore,
      baseline.nrs,
      baseline.painScore,
      baseline.painNrs,
    ];
    for (const candidate of candidates) {
      const n = asNrs(candidate);
      if (n != null) return n;
    }

    const fromJson = scanNrsInText(JSON.stringify(baseline));
    if (fromJson != null) return fromJson;
  }

  if (extraText && extraText.trim()) {
    return scanNrsInText(extraText);
  }
  return null;
}

export function buildPatientSimulatorCaseInput(params: {
  body: BodyInput;
  /** Da DB quando disponibile */
  clinicalCase: {
    description: string;
    correctSolution: string | null;
    baselineExamFindings: unknown;
  } | null;
  patientStress: number;
}): PatientSimulatorCaseInput {
  const { body, clinicalCase, patientStress } = params;
  const baseline = (clinicalCase?.baselineExamFindings ?? null) as BaselineFindings | null;
  const demo = baseline?.demographics as {
    age?: unknown;
    sex?: unknown;
    gender?: unknown;
  } | undefined;

  const patientAge = firstNonEmpty(
    body.patientAge ?? body.patient_age,
    demo?.age != null && demo.age !== "" ? `${demo.age}` : "",
  );
  const dbSex = firstNonEmpty(demo?.sex, demo?.gender);
  const bodySex = firstNonEmpty(
    body.patientSex ?? body.patient_sex,
    body.gender,
  );
  // Prefer Prisma/case demographics over the client body: the chat client used to
  // default unknown sex to "M", which overrode female patients (e.g. Federica).
  const patientSexRaw = clinicalCase
    ? firstNonEmpty(dbSex, bodySex)
    : firstNonEmpty(bodySex, dbSex);
  const patientSexCanonical = resolvePatientGrammaticalGender(patientSexRaw);
  const chiefComplaint = firstNonEmpty(
    body.chiefComplaint ?? body.chief_complaint,
    clinicalCase?.description,
    body.casePrompt,
  );

  const vitalFromBody = firstNonEmpty(body.vitalSigns ?? body.vital_signs);
  const vitalFromBaseline = formatVitalSignsFromBaseline(baseline ?? undefined);
  // DB baseline JSON is the SSOT. Never let client monitor/demo values override it.
  const vitalSigns = clinicalCase
    ? vitalFromBaseline || "(non specificati — NON inventare valori)"
    : vitalFromBody || vitalFromBaseline || "(non specificati — NON inventare valori)";

  const abnormalFromBody = firstNonEmpty(body.abnormalExams ?? body.abnormal_exams);
  const abnormalFromBaseline = formatAbnormalExamsFromBaseline(baseline ?? undefined);
  const abnormalExams =
    abnormalFromBody ||
    abnormalFromBaseline ||
    "(nessuna alterazione esplicitata nel caso — NON inventare esami o valori)";

  const trueDiagnosis =
    clinicalCase?.correctSolution && str(clinicalCase.correctSolution)
      ? str(clinicalCase.correctSolution)
      : "(non definita nel caso)";

  return {
    patientAge: patientAge || "(non specificata)",
    patientSex: patientSexCanonical ?? (patientSexRaw || "(non specificato)"),
    chiefComplaint: chiefComplaint || "(non specificato)",
    vitalSigns,
    patientStress,
    // Never trust client-supplied trueDiagnosis / true_diagnosis (prompt injection / gold leak).
    trueDiagnosis,
    abnormalExams,
    clinicalSignsJson: serializeClinicalSignsJson(baseline ?? undefined),
    painNrs: parsePainNrs(baseline, chiefComplaint),
  };
}
