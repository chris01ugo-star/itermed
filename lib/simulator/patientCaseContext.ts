import { patientSafeAnamnesisFact, resolvePatientProfile } from "@/lib/cases/resolve-patient-profile";
import type { PatientSimulatorCaseInput } from "@/lib/simulator/patient-system-prompt";
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
    id?: string | null;
    title?: string | null;
    description: string;
    correctSolution: string | null;
    baselineExamFindings: unknown;
    patientPrompt?: string | null;
    pastMedicalHistory?: string | null;
    presentation?: string | null;
    setting?: string | null;
    diagnosis?: string | null;
    condition?: string | null;
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
    clinicalCase ? "" : body.patientAge ?? body.patient_age,
    demo?.age != null && demo.age !== "" ? `${demo.age}` : "",
  );
  const dbSex = firstNonEmpty(demo?.sex, demo?.gender);
  const bodySex = firstNonEmpty(
    body.patientSex ?? body.patient_sex,
    body.gender,
  );
  const patientSexRaw = clinicalCase ? dbSex : firstNonEmpty(bodySex, dbSex);
  const chiefComplaint = firstNonEmpty(
    clinicalCase ? "" : body.chiefComplaint ?? body.chief_complaint,
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

  const explicitName = clinicalCase
    ? ""
    : firstNonEmpty(
        body.patientName ?? body.patient_name,
        demo?.name,
        demo?.firstName,
        demo?.givenName,
        demo?.fullName,
      );
  const serverProfile = clinicalCase
    ? resolvePatientProfile({
        id: clinicalCase.id,
        title: clinicalCase.title,
        description: clinicalCase.description,
        patientPrompt: firstNonEmpty(
          clinicalCase.patientPrompt,
          typeof body.casePrompt === "string" ? body.casePrompt : "",
          typeof body.patientPrompt === "string" ? body.patientPrompt : "",
        ),
        pastMedicalHistory: clinicalCase.pastMedicalHistory,
        presentation: clinicalCase.presentation,
        setting: clinicalCase.setting,
        baselineExamFindings: clinicalCase.baselineExamFindings,
        correctSolution: clinicalCase.correctSolution,
        diagnosis: clinicalCase.diagnosis,
        condition: clinicalCase.condition,
      })
    : null;
  const persona = resolvePatientPersona({
    explicitSex: serverProfile?.sex ?? patientSexRaw,
    explicitName: serverProfile?.name || explicitName || null,
    texts: serverProfile
      ? []
      : [
          typeof body.casePrompt === "string" ? body.casePrompt : "",
          typeof body.patientPrompt === "string" ? body.patientPrompt : "",
          typeof body.title === "string" ? body.title : "",
          typeof body.caseTitle === "string" ? body.caseTitle : "",
          chiefComplaint,
          clinicalCase?.description,
        ],
  });

  return {
    patientAge: serverProfile
      ? serverProfile.age != null
        ? String(serverProfile.age)
        : "(non specificata)"
      : patientAge || "(non specificata)",
    patientName: serverProfile?.name ?? persona.name,
    patientSex: serverProfile?.sex ?? persona.gender ?? (patientSexRaw || "(non specificato)"),
    chiefComplaint: serverProfile?.triageAnamnesis || chiefComplaint || "(non specificato)",
    clinicalStory: serverProfile?.triageAnamnesis || firstNonEmpty(clinicalCase?.description, chiefComplaint) || "(non specificata)",
    vitalSigns,
    patientStress,
    trueDiagnosis,
    abnormalExams,
    clinicalSignsJson: serializeClinicalSignsJson(baseline ?? undefined),
    painNrs: parsePainNrs(baseline, chiefComplaint),
    knownAllergies: serverProfile?.allergies ?? extractPatientAllergies(baseline),
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
  familyHistory: string;
  homeMedications: string;
  habits: string;
  /** Unione di farmaci, abitudini e familiarità. La frase vuota di familiarità vive solo in `familyHistory`. */
  homeMedicationsOrHabits: string;
  mandatoryAnamnesisFacts: string[];
};

const SURGERY_CUE =
  /\b(operat[oaie]|intervento|interventi|chirurgic\w*|appendicectom\w*|colecistectom\w*|bypass|protes\w*|isterectom\w*|prostatectom\w*|angioplast\w*|stent|pacemaker|biopsia|trapiant\w*|resezion\w*|amputaz\w*|cesareo|laparoscop\w*|toracotom\w*|sternotom\w*|cateterismo)\b/i;
const SURGERY_DENIAL =
  /\b(non\s+(?:è\s+|e'\s+)?(?:mai\s+)?(?:stato|stata|stati|state)\s+operat|nessun\w*\s+intervent|mai\s+operat|non\s+ha\s+subit\w*\s+intervent|non\s+è\s+stato\s+sottopost|neg\w*\s+intervent)\b/i;
const FAMILY_CUE =
  /\b(familiarit[aà]|familiare|padre|madre|pap[àa]|mamma|fratell\w*|sorell\w*|nonn[oa]|zi[oa]|figli[oa]|genitori|ereditari\w*)\b/iu;
const MED_CUE =
  /\b(farmac\w*|pillol\w*|assume|prende|in\s+terapia|terapia\s+domiciliare|terapia\s+in\s+atto|antibiotico)\b/i;
const HABIT_CUE =
  /\b(fum\w*|sigarett\w*|alcol\w*|vino|lavoro|lavorativ\w*|occupazion\w*|professione)\b/i;
const FAMILY_DENIAL =
  /\b(nessuna\s+familiarit|non\s+(?:c['’]?è|ce|ho|ha)\s+familiarit|nega\s+familiarit|familiarit[aà]\s+negativa|nessun\s+familiare)\b/i;
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
    sanitizeGenderSlashes(patientSafeAnamnesisFact(value ?? ""), sex);

  const history = clean(input.pastMedicalHistory);
  const presentation = clean(input.presentation);
  const script = clean(input.script);
  const description = clean(input.description);
  const corpus = [history, presentation, script, description].filter(Boolean).join("\n");

  const rawFamilyCorpus = [input.pastMedicalHistory, input.script, input.description]
    .map((value) => value ?? "")
    .join("\n");
  const familyDeclared =
    hasPositiveFamily(rawFamilyCorpus) || hasPositiveFamily(input.presentation ?? "");

  const sentences = splitFacts(corpus);
  const historySentences = uniqueFacts(splitFacts(history), 40);
  const family = uniqueFacts(
    sentences.filter((sentence) => FAMILY_CUE.test(sentence) && !FAMILY_DENIAL.test(sentence)),
    24,
  );
  const medications = uniqueFacts(
    sentences.filter((sentence) => MED_CUE.test(sentence)),
    16,
  );
  const habits = uniqueFacts(
    sentences.filter((sentence) => HABIT_CUE.test(sentence)),
    16,
  );
  const surgeries = uniqueFacts(
    sentences.filter((sentence) => SURGERY_CUE.test(sentence) && !SURGERY_DENIAL.test(sentence)),
    8,
  );
  const pastDiseases = uniqueFacts(
    historySentences.filter(
      (sentence) =>
        !isExclusive(sentence, FAMILY_CUE, [MED_CUE, HABIT_CUE, ALLERGY_DENIAL, SURGERY_CUE]) &&
        !isExclusive(sentence, HABIT_CUE, [FAMILY_CUE, MED_CUE, SURGERY_CUE]) &&
        !isExclusive(sentence, MED_CUE, [FAMILY_CUE, HABIT_CUE, SURGERY_CUE]),
    ),
    40,
  );

  const fromBaseline = [
    ...(input.knownAllergies ?? []),
    ...extractPatientAllergies(input.baselineExamFindings),
  ].map((item) => clean(item).trim());
  const fromText: string[] = [];
  for (const match of corpus.matchAll(new RegExp(ALLERGY_MENTION.source, "gi"))) {
    const label = match[1]?.trim();
    if (label && !ALLERGY_DENIAL.test(label)) fromText.push(label);
  }
  const allergies = uniqueFacts(
    [...fromBaseline, ...fromText].filter((item) => item.length > 1 && !ALLERGY_DENIAL.test(item)),
    8,
  );

  const familyHistory = familyDeclared
    ? family.length > 0
      ? family.join(" ")
      : "Nello storico del caso c'è un dato di familiarità: non negarlo se il medico lo chiede."
    : "Nessuna familiarità esplicitata";
  const homeMedications =
    medications.length > 0
      ? medications.join(" ")
      : "Nessun farmaco domiciliare esplicitato nello storico. Non inventarne.";
  const habitLine =
    habits.length > 0
      ? habits.join(" ")
      : "Nessuna abitudine di fumo, alcol o lavoro esplicitata nello storico. Non inventarne.";

  return {
    biologicalSex: sex,
    grammaticalAnchor: grammaticalAnchorFor(sex),
    surgeriesAndProcedures:
      surgeries.length > 0 ? surgeries.join(" ") : noSurgeryLine(sex),
    chronicConditionsAndHistory:
      pastDiseases.length > 0
        ? pastDiseases.join(" ")
        : historySentences.length > 0
          ? historySentences.join(" ")
          : "Nessuna anamnesi patologica remota riportata nel caso. Non inventare malattie pregresse.",
    allergies: allergies.length > 0 ? allergies.join("; ") : "Nessuna allergia nota",
    familyHistory,
    homeMedications,
    habits: habitLine,
    homeMedicationsOrHabits: [homeMedications, habitLine, familyHistory].join(" "),
    mandatoryAnamnesisFacts: [],
  };
}

function hasPositiveFamily(text: string): boolean {
  return splitFacts(text).some((sentence) => FAMILY_CUE.test(sentence) && !FAMILY_DENIAL.test(sentence))
    || (FAMILY_CUE.test(text) && !FAMILY_DENIAL.test(text) && text.trim().length > 0 && !splitFacts(text).length);
}

function isExclusive(sentence: string, cue: RegExp, others: RegExp[]): boolean {
  return cue.test(sentence) && others.every((other) => !other.test(sentence));
}
