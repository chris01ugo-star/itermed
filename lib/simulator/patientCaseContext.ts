import type { PatientSimulatorCaseInput } from "./patient-system-prompt";
import {
  grammaticalAnchorFor,
  resolvePatientPersona,
  sanitizeGenderSlashes,
} from "@/lib/simulator/patient-grammatical-gender";
import { extractPatientAllergies } from "@/lib/services/evaluation-allergies";
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

/** Sensazioni dell'esame obiettivo per il prompt. I preset di esami futuri restano fuori. */
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

  return chunks.join("\n");
}

/** Drop future lab and imaging presets. The patient only knows what the body feels. */
function stripFutureExamDump(text: string): string {
  if (!text) return "";
  return text
    .split("\n")
    .filter(
      (line) =>
        !line.startsWith("Valori esami di laboratorio/strumentali") &&
        !line.startsWith("Note esami:"),
    )
    .join("\n")
    .trim();
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
    name?: unknown;
    firstName?: unknown;
    givenName?: unknown;
    fullName?: unknown;
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

  const abnormalFromBody = stripFutureExamDump(
    firstNonEmpty(body.abnormalExams ?? body.abnormal_exams),
  );
  const abnormalFromBaseline = formatAbnormalExamsFromBaseline(baseline ?? undefined);
  // Physical findings only. A client payload must not reintroduce future lab/PET JSON.
  const abnormalExams =
    (clinicalCase ? abnormalFromBaseline || abnormalFromBody : abnormalFromBody || abnormalFromBaseline) ||
    "(nessuna sensazione fisica esplicitata oltre al copione — non inventare esami)";

  const trueDiagnosis =
    clinicalCase?.correctSolution && str(clinicalCase.correctSolution)
      ? str(clinicalCase.correctSolution)
      : "(non definita nel caso)";

  const explicitName = firstNonEmpty(
    body.patientName ?? body.patient_name,
    demo?.name,
    demo?.firstName,
    demo?.givenName,
    demo?.fullName,
  );
  // Sex is resolved before the prompt: a dedicated field wins; otherwise the
  // anagraphic name or the case narrative decides grammatical gender.
  const persona = resolvePatientPersona({
    explicitSex: patientSexRaw,
    explicitName,
    texts: [
      typeof body.casePrompt === "string" ? body.casePrompt : "",
      typeof body.patientPrompt === "string" ? body.patientPrompt : "",
      typeof body.title === "string" ? body.title : "",
      typeof body.caseTitle === "string" ? body.caseTitle : "",
      chiefComplaint,
      clinicalCase?.description,
    ],
  });

  return {
    patientAge: patientAge || "(non specificata)",
    patientName: persona.name,
    patientSex: persona.gender ?? (patientSexRaw || "(non specificato)"),
    chiefComplaint: chiefComplaint || "(non specificato)",
    clinicalStory: firstNonEmpty(clinicalCase?.description, chiefComplaint) || "(non specificata)",
    vitalSigns,
    patientStress,
    // Never trust client-supplied trueDiagnosis / true_diagnosis (prompt injection / gold leak).
    trueDiagnosis,
    abnormalExams,
    clinicalSignsJson: serializeClinicalSignsJson(baseline ?? undefined),
    painNrs: parsePainNrs(baseline, chiefComplaint),
    knownAllergies: extractPatientAllergies(baseline),
  };
}

export type AnamnesisFactSource = {
  prompt?: string | null;
  rationale?: string | null;
  expectedKeywords?: string[] | null;
};

export type StructuredAnamnesisTruth = {
  biologicalSex: "M" | "F";
  grammaticalAnchor: string;
  surgeriesAndProcedures: string;
  chronicConditionsAndHistory: string;
  allergies: string;
  homeMedicationsOrHabits: string;
  mandatoryAnamnesisFacts: string[];
};

const SURGERY_CUE =
  /\b(operat[oaie]|intervento|interventi|chirurgic\w*|appendicectom\w*|colecistectom\w*|bypass|protes\w*|isterectom\w*|prostatectom\w*|angioplast\w*|stent|pacemaker|biopsia|trapiant\w*|resezion\w*|amputaz\w*|cesareo|laparoscop\w*|toracotom\w*|sternotom\w*|cateterismo)\b/i;
const SURGERY_DENIAL =
  /\b(non\s+(?:è\s+|e'\s+)?(?:mai\s+)?(?:stato|stata|stati|state)\s+operat|nessun\w*\s+intervent|mai\s+operat|non\s+ha\s+subit\w*\s+intervent|non\s+è\s+stato\s+sottopost|neg\w*\s+intervent)\b/i;
const HABIT_CUE =
  /\b(farmac\w*|terapia|assume|prende|pillol\w*|fumo|fuma|sigarett\w*|alcol|vino|familiar\w*|padre|madre|fratell\w*|sorell\w*)\b/i;
const ALLERGY_MENTION = /allergic[oa]\s+a[l']?\s+([^.;]+)/gi;
const ALLERGY_DENIAL = /\bnessuna\s+allerg|non\s+(?:è\s+)?allergic|nega\s+allerg/i;

function splitFacts(text: string): string[] {
  return text
    .split(/\n+|(?<=[.!?;])\s+/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter((part) => part.length >= 12);
}

function uniqueFacts(facts: string[], limit = 12): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const fact of facts) {
    const key = fact.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(fact);
    if (out.length >= limit) break;
  }
  return out;
}

function noSurgeryLine(sex: "M" | "F"): string {
  const been = sex === "F" ? "sei stata operata" : "sei stato operato";
  return `Nessun intervento chirurgico riportato in anamnesi: se il medico chiede se ${been}, rispondi di no. Non inventare interventi.`;
}

/**
 * Deterministic anamnesis the patient model must not contradict.
 * Gender slashes are resolved before the facts are returned.
 */
export function extractStructuredAnamnesisTruth(input: {
  sex: "M" | "F" | null;
  pastMedicalHistory?: string | null;
  presentation?: string | null;
  script?: string | null;
  description?: string | null;
  anamnesisQuestions?: AnamnesisFactSource[] | null;
  knownAllergies?: string[] | null;
  baselineExamFindings?: unknown;
}): StructuredAnamnesisTruth | null {
  const sex = input.sex;
  if (!sex) return null;

  const clean = (value: string | null | undefined) =>
    sanitizeGenderSlashes(value ?? "", sex);

  const history = clean(input.pastMedicalHistory);
  const corpus = [
    history,
    clean(input.presentation),
    clean(input.script),
    clean(input.description),
    ...(input.anamnesisQuestions ?? []).flatMap((item) => [
      clean(item.prompt),
      clean(item.rationale),
      ...(item.expectedKeywords ?? []).map((keyword) => clean(keyword)),
    ]),
  ]
    .filter(Boolean)
    .join("\n");

  const sentences = splitFacts(corpus);
  const surgeries = uniqueFacts(
    sentences.filter((sentence) => SURGERY_CUE.test(sentence) && !SURGERY_DENIAL.test(sentence)),
    6,
  );

  const historySentences = uniqueFacts(splitFacts(history), 12);
  const habits = uniqueFacts(
    sentences.filter((sentence) => HABIT_CUE.test(sentence)),
    8,
  );

  const fromBaseline = [
    ...(input.knownAllergies ?? []),
    ...extractPatientAllergies(input.baselineExamFindings),
  ].map((item) => clean(item).trim());
  const fromText: string[] = [];
  if (!ALLERGY_DENIAL.test(corpus)) {
    for (const match of corpus.matchAll(ALLERGY_MENTION)) {
      const label = match[1]?.trim();
      if (label) fromText.push(label);
    }
  }
  const allergies = uniqueFacts(
    [...fromBaseline, ...fromText].filter((item) => item.length > 1 && !ALLERGY_DENIAL.test(item)),
    8,
  );

  const mandatory = (input.anamnesisQuestions ?? []).flatMap((item) => {
    const prompt = clean(item.prompt).trim();
    const rationale = clean(item.rationale).trim();
    if (!prompt && !rationale) return [];
    const keywords = (item.expectedKeywords ?? [])
      .map((keyword) => clean(keyword).trim())
      .filter(Boolean);
    const keywordNote = keywords.length > 0 ? ` Parole del caso: ${keywords.join(", ")}.` : "";
    return [
      `Se il medico indaga su [${prompt || rationale}], DEVI riferire coerentemente: ${rationale || prompt}.${keywordNote}`,
    ];
  });

  return {
    biologicalSex: sex,
    grammaticalAnchor: grammaticalAnchorFor(sex),
    surgeriesAndProcedures:
      surgeries.length > 0 ? surgeries.join(" ") : noSurgeryLine(sex),
    chronicConditionsAndHistory:
      historySentences.length > 0
        ? historySentences.join(" ")
        : "Nessuna anamnesi patologica remota riportata nel caso. Non inventare malattie pregresse.",
    allergies: allergies.length > 0 ? allergies.join("; ") : "Nessuna allergia nota",
    homeMedicationsOrHabits:
      habits.length > 0
        ? habits.join(" ")
        : "Nessun farmaco domiciliare, abitudine o familiarità esplicitata nello storico. Non inventarne.",
    mandatoryAnamnesisFacts: mandatory,
  };
}
