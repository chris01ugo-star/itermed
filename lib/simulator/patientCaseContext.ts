import type { PatientSimulatorCaseInput } from "./generatePatientResponse";

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

/** Formatta i parametri vitali dal JSON `baselineExamFindings.vitals`. */
export function formatVitalSignsFromBaseline(baseline: Record<string, unknown> | null | undefined): string {
  if (!baseline || typeof baseline !== "object") return "";
  const v = baseline.vitals as Record<string, unknown> | undefined;
  if (!v || typeof v !== "object") return "";
  const parts: string[] = [];
  if (v.heartRate != null && v.heartRate !== "") parts.push(`FC ${v.heartRate}`);
  if (v.bloodPressure != null && str(v.bloodPressure)) parts.push(`PA ${str(v.bloodPressure)}`);
  if (v.spo2 != null && v.spo2 !== "") parts.push(`SpO₂ ${v.spo2}%`);
  if (v.temperature != null && v.temperature !== "") parts.push(`T ${v.temperature} °C`);
  if (v.respiratoryRate != null && v.respiratoryRate !== "") parts.push(`FR ${v.respiratoryRate}`);
  return parts.join("; ");
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
  const demo = baseline?.demographics as { age?: unknown; sex?: unknown } | undefined;

  const patientAge = firstNonEmpty(
    body.patientAge ?? body.patient_age,
    demo?.age != null && demo.age !== "" ? `${demo.age}` : "",
  );
  const patientSex = firstNonEmpty(body.patientSex ?? body.patient_sex, demo?.sex);
  const chiefComplaint = firstNonEmpty(
    body.chiefComplaint ?? body.chief_complaint,
    clinicalCase?.description,
    body.casePrompt,
  );

  const vitalFromBody = firstNonEmpty(body.vitalSigns ?? body.vital_signs);
  const vitalFromBaseline = formatVitalSignsFromBaseline(baseline ?? undefined);
  // Prefer explicit "unknown" over inventable placeholders when case has no vitals.
  const vitalSigns = vitalFromBody || vitalFromBaseline || "(non specificati — NON inventare valori)";

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
    patientSex: patientSex || "(non specificato)",
    chiefComplaint: chiefComplaint || "(non specificato)",
    vitalSigns,
    patientStress,
    // Never trust client-supplied trueDiagnosis / true_diagnosis (prompt injection / gold leak).
    trueDiagnosis,
    abnormalExams,
  };
}
