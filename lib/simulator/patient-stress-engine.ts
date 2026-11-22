import { resolvePatientProfile } from "@/lib/cases/resolve-patient-profile";
import { normalizeStepId } from "@/lib/cases/simulation-time";
import { isInvasiveExam, resolveCanonicalExam } from "@/lib/simulator/exam-canonical-registry";

/** Inclusive crisis threshold shared by the bar, the prompt and the report penalty. */
export const CRITICAL_STRESS_THRESHOLD = 80;

export function isCriticalPatientStress(value: number): boolean {
  return Number.isFinite(value) && value >= CRITICAL_STRESS_THRESHOLD;
}

/** Per-case stress configuration stored in `baselineExamFindings.stressProfile`. */
export interface StressProfile {
  initialStress: number;
  reactivityType: "hyper" | "hypo" | "standard";
  timeDecayRate: number;
  criticalMilestones: {
    reduceStress: string[];
    increaseStress: string[];
  };
  /** Milestone keys that halt hypo deterioration when completed */
  lifesavingMilestones?: string[];
  /** Exam ids / canonical keys that reduce stress when appropriately ordered */
  relievingExams?: string[];
  /** Exam or therapy keys that spike stress when wrongly prescribed */
  dangerousPrescriptions?: string[];
  /** Lowest stress while the acute driver is untreated. */
  physiologicalFloor: number;
  /** Symptom the patient is living, without the hidden diagnosis. */
  caseContext: CaseContextProfile;
}

export type DominantSymptom = "dyspnea" | "chest" | "shock" | "sensitive" | "general";

export type CaseContextProfile = {
  dominantSymptom: DominantSymptom;
  specificTriggers: string[];
  specificReliefs: string[];
  baselineStatusLabel: string;
};

export type StressEventCategory =
  | "communication"
  | "clinical_action"
  | "deterioration"
  | "time"
  | "diagnosis"
  | "baseline";

export type StressSeverity = "calm" | "elevated" | "critical";

export type StressTurnEvent = {
  stress: number;
  delta: number;
  reason: string;
  category: StressEventCategory;
  severity: StressSeverity;
};

export type StressTimelineEntry = {
  atMinute: number;
  turn: number;
  stress: number;
  delta: number;
  reason: string;
  category: StressEventCategory;
};

export type MessageTone = "empathetic" | "cold" | "aggressive" | "neutral";

export type StressEngineInput = {
  currentStress: number;
  profile: StressProfile;
  lastUserMessage?: string;
  /** Optional LLM-side empathy flag from future classifier */
  llmEmpathyDetected?: boolean;
  newExamId?: string;
  newExamName?: string;
  completedMilestoneKeys?: string[];
  goldStandardPath?: string[];
  /** Minutes elapsed since last temporal tick (default 1 for per-minute decay) */
  elapsedMinutes?: number;
  /** Chat turns without lifesaving intervention (hypo profile) */
  turnsWithoutLifesaving?: number;
  wrongDiagnosis?: boolean;
  /** Heuristic: therapy/exam clinically inappropriate for this case */
  riskyPrescription?: boolean;
  painNrs?: number | null;
  spo2?: number | null;
  systolic?: number | null;
  description?: string;
  /** Exams already ordered. A relieving exam lifts the pathological floor. */
  requestedExamIds?: string[];
  /** Physical maneuver that hurts if done without warning. */
  painfulManeuver?: boolean;
  respiratoryRate?: number | null;
  /** Earlier doctor lines, used to shrink repeated reassuring formulas. */
  recentDoctorMessages?: string[];
};

const EMPATHY_PATTERNS = [
  /capisco|comprendo|mi dica|racconti|come si sente|tranquill|non si preoccup|ci pensiamo|rassicur|sono qui|la aiut|insieme/i,
];
const COLD_PATTERNS = [
  /^\s*(ok|si|no|bene|ah)\s*[.!?]?\s*$/i,
  /devi|dovete|subito|veloce|sbrigat/i,
];
const AGGRESSIVE_PATTERNS = [
  /\b(sbrigati|muoviti|basta|zitto|non mi interessa|idiota|stupido)\b/i,
  /\b(devi|devono)\s+(fare|prendere|stare)/i,
];

/** Keyword heuristics for configured critical milestone keys. */
const CRITICAL_MILESTONE_PATTERNS: Record<string, RegExp[]> = {
  somministrazione_ossigeno: [/ossigen|o2\b|mascher|venturi|sipap|hfnc|ossigenoterapia/i],
  rassicurazione_paziente: [/tranquill|non si preoccup|capisco|ci pensiamo|rassicur|sono qui/i],
  ascolto_attivo: [/capisco|mi dica|raccont|come si sente|preoccup/i],
  comunicazione_empatica: [/tranquill|spieg|in parole semplici|ci pens/i],
  consenso_informato: [/consenso|informat|autorizz|spieg.*rischi/i],
  procedura_invasiva_non_spiegata: [/cateter|intub|puncion|invasiv|biopsia|drenaggio/i],
  ritardo_diagnostico: [/aspett|piu tardi|non serve|rimand/i],
  terapia_errata: [/furosemid|morfina|beta.?blocc|nitro(?!.*indic)/i],
  esame_inappropriato: [/rm encefalo|tac addome|emogas/i],
};

const DEFAULT_LIFESAVING = [
  "somministrazione_ossigeno",
  "richiesto_ecg",
  "richiesto_tc_encefalo",
  "piano_terapeutico",
  "anamnesi_completa",
];

function clampStress(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function classifyMessageTone(message?: string, llmEmpathyDetected?: boolean): MessageTone {
  if (llmEmpathyDetected) return "empathetic";
  if (!message?.trim()) return "neutral";
  if (EMPATHY_PATTERNS.some((p) => p.test(message))) return "empathetic";
  if (AGGRESSIVE_PATTERNS.some((p) => p.test(message))) return "aggressive";
  if (COLD_PATTERNS.some((p) => p.test(message))) return "cold";
  if (message.trim().length < 8) return "cold";
  return "neutral";
}

const EXPLAINS =
  /spieg|significa|in parole semplici|serve a|perch[eé]|vuol dire|le faccio|adesso (le |facciamo|controlliamo)|consiste nel|è un (prelievo|controllo|esame)/i;
const VALIDATION =
  /capisco|comprendo|deve essere (difficile|spaventoso|doloroso)|è normale (avere paura|essere preoccupat)|mi dispiace|la ascolto|ha ragione a preoccuparsi/i;
const CONSENT =
  /posso (visitarla|procedere|farle)|è d'accordo|le va bene|consente|autorizza|prima di (farle|procedere|iniziare)|se per lei va bene|le chiedo il permesso/i;
const REASSURE =
  /ci pensiamo|siamo qui|la teniamo (d'occhio|sotto controllo)|non la lasciamo|passo passo|insieme|la aiut/i;
const WARM = /buongiorno|buonasera|come si sente|mi racconti|mi dica pure|la ascolto|si accomodi/i;
const MINIMIZE =
  /non è niente|è solo (ansia|stress|psicologic)|esagera|non fa (così )?male|si lament|è nella (sua|tua) testa|ipocondri/i;
const BLAME =
  /\b(sbrigati|muoviti|basta|zitto|non mi interessa|idiota|stupido)\b|\bè colpa (sua|tua)\b|\bdoveva\b|\bperché non ha\b/i;
const JARGON =
  /\b(troponin\w*|coronarograf\w*|ischemi\w*|fibrillazion\w*|dispnea|scompenso|creatinin\w*|emogas|procalcitonin\w*|neutropeni\w*|trombolisi|cateterismo)\b/i;
const INVASIVE_WORDS =
  /cateter|puntura|biopsia|endoscop|rettale|intub|drenaggio|rachicentesi|emogas|\bago\b/i;
const ACUTE_TEXT =
  /shock|ipotens|sopor|coma|gcs\s*[0-8]|stemi|infarto|dispnea improvvisa|emorrag|sepsi|anafil|dolore toracico/i;

type DoctorSignal = { relief: number; penalty: number };

function analyzeDoctorMessage(message: string | undefined, llmEmpathy?: boolean): DoctorSignal {
  const text = message?.trim() ?? "";
  if (!text && !llmEmpathy) return { relief: 0, penalty: 0 };

  let relief = 0;
  let penalty = 0;
  if (llmEmpathy || VALIDATION.test(text) || EMPATHY_PATTERNS.some((pattern) => pattern.test(text))) {
    relief += 8;
  }
  if (EXPLAINS.test(text)) relief += 6;
  if (CONSENT.test(text)) relief += 7;
  if (REASSURE.test(text)) relief += 5;
  if (WARM.test(text)) relief += 4;
  if (relief > 16) relief = 16;

  if (MINIMIZE.test(text)) penalty += 14;
  if (BLAME.test(text) || AGGRESSIVE_PATTERNS.some((pattern) => pattern.test(text))) penalty += 16;
  const questions = text ? text.split("?").length - 1 : 0;
  if (questions >= 3 && relief < 6) penalty += 8;
  if (JARGON.test(text) && !EXPLAINS.test(text)) penalty += 6;
  if (INVASIVE_WORDS.test(text) && !EXPLAINS.test(text) && !CONSENT.test(text)) penalty += 12;
  if (text && relief === 0 && (COLD_PATTERNS.some((pattern) => pattern.test(text)) || text.length < 8)) {
    penalty += 6;
  }
  return { relief, penalty };
}

function reliefFactor(type: StressProfile["reactivityType"]): number {
  if (type === "hyper") return 0.85;
  if (type === "hypo") return 0.4;
  return 1;
}

function penaltyFactor(type: StressProfile["reactivityType"]): number {
  if (type === "hyper") return 1.7;
  if (type === "hypo") return 0.55;
  return 1;
}

/** Words calm less as stress approaches the pathological floor. */
function diminishingRelief(current: number, floor: number): number {
  if (current <= floor + 4) return 0.15;
  if (current <= floor + 12) return 0.4;
  if (current <= floor + 25) return 0.7;
  return 1;
}

export function pathologicalStressFloor(params: {
  profile: StressProfile;
  painNrs?: number | null;
  spo2?: number | null;
  systolic?: number | null;
  respiratoryRate?: number | null;
  description?: string;
  treated?: boolean;
}): number {
  if (params.treated) return 0;
  if (params.profile.physiologicalFloor > 0 && !params.treated) {
    const authored = params.profile.physiologicalFloor;
    const text = params.description ?? "";
    const pain = params.painNrs ?? 0;
    const spo2 = params.spo2 != null && params.spo2 > 0 ? params.spo2 : null;
    const rr = params.respiratoryRate != null && params.respiratoryRate > 0 ? params.respiratoryRate : null;
    const shock =
      /shock|ipotens|sopor|coma|sepsi/i.test(text) ||
      (params.systolic != null && params.systolic > 0 && params.systolic < 90);
    const severe = pain >= 7 || (spo2 != null && spo2 < 90) || (rr != null && rr >= 24) || shock;
    if (severe) return Math.max(authored, 45);
    return authored;
  }
  const text = params.description ?? "";
  const pain = params.painNrs ?? 0;
  const spo2 = params.spo2 != null && params.spo2 > 0 ? params.spo2 : null;
  const rr = params.respiratoryRate != null && params.respiratoryRate > 0 ? params.respiratoryRate : null;
  const shock =
    /shock|ipotens|sopor|coma|sepsi/i.test(text) ||
    (params.systolic != null && params.systolic > 0 && params.systolic < 90);
  const severe = pain >= 9 || (spo2 != null && spo2 < 90) || (rr != null && rr >= 24) || shock;
  const acute = pain >= 7 || (spo2 != null && spo2 < 92) || shock || ACUTE_TEXT.test(text);
  if (severe) return 45;
  if (acute) return params.profile.reactivityType === "hypo" ? 40 : 35;
  return 0;
}

function spo2FromUnknown(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) && value > 0 ? value : null;
}

function matchesMilestoneKey(key: string, message: string, examId?: string, examName?: string): boolean {
  const patterns = CRITICAL_MILESTONE_PATTERNS[key];
  const haystack = `${message} ${examId ?? ""} ${examName ?? ""}`;
  if (patterns?.some((p) => p.test(haystack))) return true;

  const normKey = normalizeStepId(key);
  const examNorm = examId ? normalizeStepId(examId) : "";
  if (examNorm && (examNorm.includes(normKey) || normKey.includes(examNorm))) return true;

  const canon = examId ? resolveCanonicalExam(examId, examName) : null;
  if (canon && (normKey.includes(canon.canonicalKey) || canon.milestoneKey === key)) return true;

  return false;
}

function milestoneSet(keys: string[] | undefined): Set<string> {
  return new Set((keys ?? []).map(normalizeStepId));
}

function isLifesavingMet(profile: StressProfile, completed: Set<string>): boolean {
  const required = profile.lifesavingMilestones ?? [];
  if (!required.length) return true;
  return required.some((k) => completed.has(normalizeStepId(k)));
}

function isRelievingExam(
  examId: string,
  examName: string | undefined,
  profile: StressProfile,
  goldStandardPath?: string[],
): boolean {
  const relieving = new Set((profile.relievingExams ?? []).map(normalizeStepId));
  const norm = normalizeStepId(examId);
  if (relieving.has(norm)) return true;

  const canon = resolveCanonicalExam(examId, examName);
  if (canon && relieving.has(normalizeStepId(canon.canonicalKey))) return true;
  if (canon && relieving.has(normalizeStepId(canon.milestoneKey))) return true;

  const gold = (goldStandardPath ?? []).map(normalizeStepId);
  return gold.some(
    (step) =>
      norm.includes(step) ||
      step.includes(norm) ||
      (canon != null && (step.includes(canon.canonicalKey) || step.includes("tc") && canon.canonicalKey.includes("tc"))),
  );
}

function isDangerousPrescription(
  examId: string | undefined,
  examName: string | undefined,
  message: string,
  profile: StressProfile,
): boolean {
  const dangerous = profile.dangerousPrescriptions ?? [];
  const haystack = `${message} ${examId ?? ""} ${examName ?? ""}`.toLowerCase();
  return dangerous.some((d) => {
    const norm = normalizeStepId(d);
    if (examId && normalizeStepId(examId).includes(norm)) return true;
    return haystack.includes(d.toLowerCase()) || haystack.includes(norm);
  });
}

function inferReactivity(description: string): StressProfile["reactivityType"] {
  const text = description.toLowerCase();
  if (/panico|ansia|attacco|infarto|stemi|nstemi|dispnea improvvisa|dolore toracico|angoscia/i.test(text)) {
    return "hyper";
  }
  if (/shock|coma|soporoso|ottuso|glasgow|gcs\s*[0-5]|apatia|ipoperfuso|sepsi severa/i.test(text)) {
    return "hypo";
  }
  return "standard";
}

function deriveCriticalMilestones(
  reactivity: StressProfile["reactivityType"],
  goldStandardPath?: string[],
): StressProfile["criticalMilestones"] {
  const reduceStress = [
    "somministrazione_ossigeno",
    "rassicurazione_paziente",
    "ascolto_attivo",
    "comunicazione_empatica",
    "consenso_informato",
  ];
  const increaseStress = ["procedura_invasiva_non_spiegata", "ritardo_diagnostico"];

  for (const step of goldStandardPath ?? []) {
    const norm = normalizeStepId(step);
    if (/ecg|elettrocardi/i.test(norm)) reduceStress.push("richiesto_ecg");
    if (/tc|tac|encefal|cranio/i.test(norm)) reduceStress.push("richiesto_tc_encefalo");
    if (/ossigen/i.test(norm)) reduceStress.push("somministrazione_ossigeno");
    if (/terap|tratt|farmaco/i.test(norm)) reduceStress.push("piano_terapeutico");
  }

  if (reactivity === "hyper") {
    increaseStress.push("ritardo_diagnostico");
  }
  if (reactivity === "hypo") {
    increaseStress.push("terapia_errata");
  }

  return {
    reduceStress: [...new Set(reduceStress)],
    increaseStress: [...new Set(increaseStress)],
  };
}

function deriveRelievingExams(goldStandardPath?: string[]): string[] {
  const exams: string[] = [];
  for (const step of goldStandardPath ?? []) {
    const norm = normalizeStepId(step);
    if (/ecg|elettrocardi/i.test(norm)) exams.push("ecg", "richiesto_ecg");
    if (/tc|tac|encefal|cranio/i.test(norm)) exams.push("tc_encefalo", "richiesto_tc_encefalo");
    if (/rx|torace|radiograf/i.test(norm)) exams.push("rx_torace", "richiesto_rx_torace");
    if (/emogas|gas arterioso/i.test(norm)) exams.push("emogas", "richiesto_emogas");
    if (/troponin/i.test(norm)) exams.push("troponina", "richiesto_troponina");
  }
  return [...new Set(exams)];
}

function normalizeStressProfile(
  raw: Record<string, unknown>,
  fallback: { description: string; goldStandardPath?: string[] },
): StressProfile {
  const reactivity =
    raw.reactivityType === "hyper" || raw.reactivityType === "hypo" || raw.reactivityType === "standard"
      ? raw.reactivityType
      : inferReactivity(fallback.description);

  const criticalRaw = raw.criticalMilestones as
    | { reduceStress?: unknown; increaseStress?: unknown }
    | undefined;

  const derived = deriveCriticalMilestones(reactivity, fallback.goldStandardPath);

  return {
    initialStress:
      typeof raw.initialStress === "number" && raw.initialStress >= 0 && raw.initialStress <= 100
        ? Math.round(raw.initialStress)
        : reactivity === "hyper"
          ? 45
          : reactivity === "hypo"
            ? 22
            : 30,
    reactivityType: reactivity,
    timeDecayRate:
      typeof raw.timeDecayRate === "number" && raw.timeDecayRate >= 0
        ? raw.timeDecayRate
        : reactivity === "hyper"
          ? 2.2
          : reactivity === "hypo"
            ? 3.5
            : 1.5,
    criticalMilestones: {
      reduceStress: Array.isArray(criticalRaw?.reduceStress)
        ? (criticalRaw.reduceStress as string[])
        : derived.reduceStress,
      increaseStress: Array.isArray(criticalRaw?.increaseStress)
        ? (criticalRaw.increaseStress as string[])
        : derived.increaseStress,
    },
    lifesavingMilestones: Array.isArray(raw.lifesavingMilestones)
      ? (raw.lifesavingMilestones as string[])
      : [...DEFAULT_LIFESAVING, ...deriveRelievingExams(fallback.goldStandardPath)],
    relievingExams: Array.isArray(raw.relievingExams)
      ? (raw.relievingExams as string[])
      : deriveRelievingExams(fallback.goldStandardPath),
    dangerousPrescriptions: Array.isArray(raw.dangerousPrescriptions)
      ? (raw.dangerousPrescriptions as string[])
      : [],
    physiologicalFloor: 0,
    caseContext: {
      dominantSymptom: "general",
      specificTriggers: [],
      specificReliefs: [],
      baselineStatusLabel: "Il paziente è in attesa.",
    },
  };
}

function inferStressProfileFromCase(description: string, goldStandardPath?: string[]): StressProfile {
  const reactivity = inferReactivity(description);
  return normalizeStressProfile(
    {
      initialStress: reactivity === "hyper" ? 45 : reactivity === "hypo" ? 22 : 30,
      reactivityType: reactivity,
      timeDecayRate: reactivity === "hyper" ? 2.2 : reactivity === "hypo" ? 3.5 : 1.5,
    },
    { description, goldStandardPath },
  );
}

type PhysiologyRead = {
  initial: number;
  floor: number;
  reactivity: StressProfile["reactivityType"];
  decay: number;
  context: CaseContextProfile;
};

function readNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function baselineVitals(baseline: Record<string, unknown> | null | undefined): {
  spo2: number | null;
  rr: number | null;
  hr: number | null;
  systolic: number | null;
  gcs: number | null;
  pain: number | null;
} {
  const vitals =
    baseline?.vitals && typeof baseline.vitals === "object" && !Array.isArray(baseline.vitals)
      ? (baseline.vitals as Record<string, unknown>)
      : {};
  const painObj =
    baseline?.pain && typeof baseline.pain === "object" && !Array.isArray(baseline.pain)
      ? (baseline.pain as Record<string, unknown>)
      : {};
  const systolic = readNumber(String(vitals.bloodPressure ?? "").split("/")[0]);
  return {
    spo2: readNumber(vitals.spo2),
    rr: readNumber(vitals.respiratoryRate ?? vitals.rr),
    hr: readNumber(vitals.heartRate ?? vitals.hr),
    systolic: systolic != null && systolic > 0 ? systolic : null,
    gcs: readNumber(vitals.gcs ?? vitals.glasgow),
    pain: readNumber(painObj.nrs ?? vitals.painScore ?? vitals.pain),
  };
}

function derivePhysiology(params: {
  id?: string | null;
  title?: string | null;
  description: string;
  presentation?: string | null;
  patientPrompt?: string | null;
  setting?: string | null;
  baselineExamFindings?: Record<string, unknown> | null;
  emotionalState?: string | null;
  communicationStyle?: string | null;
}): PhysiologyRead {
  const chart = resolvePatientProfile({
    id: params.id,
    title: params.title,
    description: params.description,
    presentation: params.presentation,
    patientPrompt: params.patientPrompt,
    setting: params.setting,
    baselineExamFindings: params.baselineExamFindings,
  });
  const vitals = baselineVitals(params.baselineExamFindings);
  const profileRaw = params.baselineExamFindings?.patientProfile;
  const profileObj =
    profileRaw && typeof profileRaw === "object" && !Array.isArray(profileRaw)
      ? (profileRaw as Record<string, unknown>)
      : {};
  const emotion = `${params.emotionalState ?? ""} ${profileObj.emotionalState ?? ""} ${params.communicationStyle ?? ""} ${profileObj.communicationStyle ?? ""}`.toLowerCase();
  const corpus = `${params.title ?? ""} ${params.description} ${params.presentation ?? ""} ${chart.triageAnamnesis}`.toLowerCase();
  const anxious = /anxious|ansia|panico|preoccup|irrequiet|angosc/.test(emotion) || /ansios|irrequiet|palpit/.test(corpus);
  const setting = chart.setting;
  const emergency = /pronto soccorso/i.test(setting);
  const guard = /guardia medica/i.test(setting);
  const shock =
    (vitals.systolic != null && vitals.systolic < 90) ||
    (vitals.gcs != null && vitals.gcs <= 12) ||
    /shock|sepsi|coma|sopor/.test(corpus);
  const hypoxic = (vitals.spo2 != null && vitals.spo2 < 90) || (vitals.rr != null && vitals.rr >= 24);
  const painful = vitals.pain != null && vitals.pain >= 7;
  const chest = /palpit|dolore torac|oppress|batte il cuore|petto/.test(corpus);
  const stable =
    !shock &&
    !hypoxic &&
    !painful &&
    (vitals.spo2 == null || vitals.spo2 >= 96) &&
    (vitals.rr == null || vitals.rr <= 20) &&
    (vitals.hr == null || (vitals.hr >= 55 && vitals.hr <= 105));

  let reactivity: StressProfile["reactivityType"] = "standard";
  let initial = emergency ? 34 : guard ? 30 : 26;
  let floor = emergency ? 12 : 8;
  let decay = emergency ? 0.8 : 0.35;
  let dominant: DominantSymptom = "general";

  if (shock) {
    reactivity = "hypo";
    initial = 64;
    floor = 45;
    decay = 3.2;
    dominant = "shock";
  } else if (hypoxic) {
    initial = vitals.spo2 != null && vitals.spo2 < 88 ? 62 : 58;
    floor = 45;
    decay = 1.8;
    reactivity = anxious ? "hyper" : "standard";
    dominant = "dyspnea";
  } else if (painful || chest) {
    initial = Math.max(initial, painful ? 58 : 48);
    floor = painful ? 45 : 22;
    decay = anxious || chest ? 1.6 : 1.2;
    reactivity = anxious || chest ? "hyper" : "standard";
    dominant = chest ? "chest" : "general";
  } else if (stable && !emergency) {
    initial = anxious ? 32 : 26;
    floor = anxious ? 12 : 8;
    decay = 0.15;
    reactivity = anxious ? "hyper" : "standard";
    dominant = anxious ? "sensitive" : "sensitive";
  }

  if (anxious && reactivity === "standard") reactivity = "hyper";
  if (anxious && dominant === "general") dominant = chest ? "chest" : "sensitive";
  if (emergency && !stable && !shock && !hypoxic) initial = Math.min(70, initial + 4);

  const context: CaseContextProfile =
    dominant === "dyspnea"
      ? {
          dominantSymptom: "dyspnea",
          specificTriggers: ["messaggi lunghi", "raffica di domande", "ritardo sull'ossigeno"],
          specificReliefs: ["ossigeno", "domande brevi", "auscultazione"],
          baselineStatusLabel: "Affannato: il fiato corto tiene alta la tensione finché non si interviene sul respiro.",
        }
      : dominant === "chest"
        ? {
            dominantSymptom: "chest",
            specificTriggers: ["minimizzare", "ritardo", "tono freddo"],
            specificReliefs: ["ECG precoce", "spiegazione sul petto", "gestione del dolore"],
            baselineStatusLabel: "Irrequieto: sente il petto e il battito, e si calma se il passo successivo è concreto.",
          }
        : dominant === "shock"
          ? {
              dominantSymptom: "shock",
              specificTriggers: ["ritardo delle manovre", "solo parole"],
              specificReliefs: ["monitoraggio", "fluidi", "intervento immediato"],
              baselineStatusLabel: "Provato: le parole da sole lo calmano poco finché non parte un intervento.",
            }
          : dominant === "sensitive"
            ? {
                dominantSymptom: "sensitive",
                specificTriggers: ["gergo non spiegato", "tono sbrigativo", "non ascoltare"],
                specificReliefs: ["spiegazione chiara", "alleanza", "percorso condiviso"],
                baselineStatusLabel: "Vigile: il quadro è stabile, ma le parole pesano più del tempo che passa.",
              }
            : {
                dominantSymptom: "general",
                specificTriggers: ["tono brusco", "fretta"],
                specificReliefs: ["ascolto", "spiegazione"],
                baselineStatusLabel: emergency
                  ? "Teso per l'attesa, ma ancora in grado di raccontare."
                  : "Abbastanza composto, in attesa di capire cosa succede.",
              };

  return { initial, floor, reactivity, decay, context };
}

export function stressSeverity(value: number): StressSeverity {
  if (isCriticalPatientStress(value)) return "critical";
  if (value >= 50) return "elevated";
  return "calm";
}

export function stressCoachCopy(profile: StressProfile): string {
  switch (profile.caseContext.dominantSymptom) {
    case "dyspnea":
      return "È molto sensibile al fiato corto: frasi lunghe e ritardi pesano, un intervento sul respiro lo calma.";
    case "chest":
      return "Il petto e il battito lo agitano: una spiegazione concreta lo rassicura più di una frase generica.";
    case "shock":
      return "È molto provato: le parole da sole lo calmano poco finché non parte un intervento.";
    case "sensitive":
      return "È stabile ma attento alle parole: il gergo non spiegato lo tende, una spiegazione chiara lo avvicina.";
    default:
      return "Reagisce al tono e alla chiarezza, più che al tempo che passa.";
  }
}

function normalizeUtterance(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isFormulaRepeat(message: string, recent: string[]): boolean {
  const norm = normalizeUtterance(message);
  if (norm.length < 18) return false;
  return recent.some((prev) => {
    const other = normalizeUtterance(prev);
    if (!other) return false;
    if (other === norm) return true;
    const a = new Set(norm.split(" ").filter((word) => word.length > 2));
    const b = new Set(other.split(" ").filter((word) => word.length > 2));
    if (a.size === 0 || b.size === 0) return false;
    let shared = 0;
    for (const word of a) if (b.has(word)) shared += 1;
    return shared / (a.size + b.size - shared) >= 0.82;
  });
}

export function withDeteriorationStress(event: StressTurnEvent): StressTurnEvent {
  const before = event.stress - event.delta;
  const stress = Math.max(event.stress, 85);
  if (stress === event.stress && event.category === "deterioration") return event;
  return {
    stress,
    delta: stress - before,
    reason: "Peggioramento clinico per ritardo negli interventi",
    category: "deterioration",
    severity: "critical",
  };
}

export function appendStressTimeline(
  existing: unknown,
  entry: StressTimelineEntry,
  cap = 40,
): StressTimelineEntry[] {
  const prior = Array.isArray(existing)
    ? existing.filter(
        (row): row is StressTimelineEntry =>
          !!row &&
          typeof row === "object" &&
          typeof (row as StressTimelineEntry).stress === "number" &&
          typeof (row as StressTimelineEntry).reason === "string",
      )
    : [];
  const meaningful =
    entry.category === "baseline" ||
    entry.category === "deterioration" ||
    entry.category === "diagnosis" ||
    entry.category === "clinical_action" ||
    Math.abs(entry.delta) >= 4;
  const next = meaningful ? [...prior, entry] : prior;
  if (next.length <= cap) return next;
  const baseline = next.find((row) => row.category === "baseline");
  const rest = next.filter((row) => row !== baseline).slice(-(cap - (baseline ? 1 : 0)));
  return baseline ? [baseline, ...rest] : rest;
}

/** Resolves per-case stress config from JSON baseline or clinical inference. */
export function resolveCaseStressProfile(params: {
  id?: string | null;
  title?: string | null;
  description: string;
  presentation?: string | null;
  patientPrompt?: string | null;
  setting?: string | null;
  emotionalState?: string | null;
  communicationStyle?: string | null;
  baselineExamFindings?: Record<string, unknown> | null;
  goldStandardPath?: string[];
}): StressProfile {
  const phys = derivePhysiology(params);
  const raw = params.baselineExamFindings?.stressProfile;
  const hasRaw = !!raw && typeof raw === "object" && !Array.isArray(raw);
  const src = hasRaw ? (raw as Record<string, unknown>) : null;
  const base = normalizeStressProfile(
    hasRaw
      ? (raw as Record<string, unknown>)
      : {
          initialStress: phys.initial,
          reactivityType: phys.reactivity,
          timeDecayRate: phys.decay,
        },
    { description: params.description, goldStandardPath: params.goldStandardPath },
  );
  const explicitReactivity =
    src?.reactivityType === "hyper" || src?.reactivityType === "hypo" || src?.reactivityType === "standard";
  return {
    ...base,
    initialStress: typeof src?.initialStress === "number" ? base.initialStress : phys.initial,
    reactivityType: explicitReactivity ? base.reactivityType : phys.reactivity,
    timeDecayRate: typeof src?.timeDecayRate === "number" ? base.timeDecayRate : phys.decay,
    physiologicalFloor:
      typeof src?.physiologicalFloor === "number"
        ? Math.max(0, Math.min(100, Math.round(src.physiologicalFloor)))
        : phys.floor,
    caseContext: phys.context,
  };
}

/** @deprecated Prefer {@link resolveCaseStressProfile}. */
export function getCaseStressProfile(
  description: string,
  _complaint?: string,
  options?: {
    baselineExamFindings?: Record<string, unknown> | null;
    goldStandardPath?: string[];
  },
): StressProfile {
  return resolveCaseStressProfile({
    description,
    baselineExamFindings: options?.baselineExamFindings,
    goldStandardPath: options?.goldStandardPath,
  });
}

function applyCriticalMilestoneDeltas(
  stress: number,
  profile: StressProfile,
  message: string,
  completed: Set<string>,
  examId?: string,
  examName?: string,
): number {
  let next = stress;

  for (const key of profile.criticalMilestones.reduceStress) {
    if (completed.has(normalizeStepId(key))) {
      next -= 6;
      continue;
    }
    if (matchesMilestoneKey(key, message, examId, examName)) {
      next -= 12;
      completed.add(normalizeStepId(key));
    }
  }

  for (const key of profile.criticalMilestones.increaseStress) {
    if (matchesMilestoneKey(key, message, examId, examName)) {
      if (key === "procedura_invasiva_non_spiegata" && !completed.has(normalizeStepId("consenso_informato"))) {
        next += 18;
      } else {
        next += 10;
      }
    }
  }

  return next;
}

type StressNote = { delta: number; reason: string; category: StressEventCategory };

function reliefReason(text: string, symptom: DominantSymptom, repeated: boolean): string {
  if (repeated) return "La stessa frase rassicura meno se si ripete";
  if (EXPLAINS.test(text) && (symptom === "sensitive" || symptom === "general" || symptom === "chest")) {
    return "Spiegazione chiara del percorso diagnostico";
  }
  if (symptom === "dyspnea" && /ossigen|fiato|respiro|satur/i.test(text)) {
    return "Parla del fiato e il paziente si sente ascoltato";
  }
  if (symptom === "chest" && /petto|palpit|cuore|elettro|ecg/i.test(text)) {
    return "Rassicurazione concreta sul sintomo che lo agita";
  }
  if (VALIDATION.test(text) || WARM.test(text)) return "Si sente ascoltato";
  return "Il tono del medico lo calma un poco";
}

function penaltyReason(text: string, symptom: DominantSymptom): string {
  if (JARGON.test(text) && !EXPLAINS.test(text)) return "Gergo tecnico non spiegato: paziente confuso e teso";
  if (MINIMIZE.test(text)) return "Si sente minimizzato";
  if (BLAME.test(text)) return "Il tono è brusco e lo chiude";
  const questions = text ? text.split("?").length - 1 : 0;
  if (symptom === "dyspnea" && (questions >= 3 || text.split(/\s+/).length > 42)) {
    return "Troppe domande di fila mentre gli manca il fiato";
  }
  if (text && text.trim().length < 8) return "Risposta telegrafica: si sente poco considerato";
  return "Il modo di parlare aumenta la tensione";
}

function pickNote(notes: StressNote[], delta: number): StressNote {
  if (notes.length === 0) {
    return { delta: 0, reason: "Il paziente resta sullo stesso livello", category: "baseline" };
  }
  const sameSign = notes.filter((note) => (delta < 0 ? note.delta < 0 : note.delta > 0));
  const pool = sameSign.length > 0 ? sameSign : notes;
  return pool.reduce((best, note) => (Math.abs(note.delta) > Math.abs(best.delta) ? note : best));
}

/**
 * Core turn-based stress update — case profile, tone, milestones, prescriptions.
 * Returns the new value and the reason the student can read under the bar.
 */
export function computePatientStress(input: StressEngineInput): StressTurnEvent {
  const {
    profile,
    lastUserMessage,
    llmEmpathyDetected,
    newExamId,
    newExamName,
    completedMilestoneKeys = [],
    goldStandardPath,
    turnsWithoutLifesaving = 0,
    wrongDiagnosis,
    riskyPrescription,
    painNrs,
    spo2,
    systolic,
    respiratoryRate,
    description,
    requestedExamIds = [],
    painfulManeuver,
    recentDoctorMessages = [],
  } = input;

  const completed = milestoneSet([
    ...completedMilestoneKeys,
    ...profile.criticalMilestones.reduceStress.filter((k) =>
      matchesMilestoneKey(k, lastUserMessage ?? "", newExamId, newExamName),
    ),
  ]);

  const treated =
    isLifesavingMet(profile, completed) ||
    requestedExamIds.some((examId) => isRelievingExam(examId, undefined, profile, goldStandardPath)) ||
    (newExamId != null && isRelievingExam(newExamId, newExamName, profile, goldStandardPath));
  const floor = pathologicalStressFloor({
    profile,
    painNrs,
    spo2: spo2FromUnknown(spo2),
    systolic,
    respiratoryRate,
    description,
    treated,
  });

  const before = input.currentStress > 0 ? input.currentStress : profile.initialStress;
  const text = lastUserMessage?.trim() ?? "";
  const symptom = profile.caseContext?.dominantSymptom ?? "general";
  const repeated = isFormulaRepeat(text, recentDoctorMessages);
  const signal = analyzeDoctorMessage(text, llmEmpathyDetected);
  const reliefScale =
    reliefFactor(profile.reactivityType) *
    diminishingRelief(before, floor) *
    (repeated ? 0.22 : 1) *
    (symptom === "shock" ? 0.35 : 1);
  const penaltyScale = penaltyFactor(profile.reactivityType) * (symptom === "sensitive" ? 1.35 : 1);
  const notes: StressNote[] = [];

  const commRelief = Math.round(signal.relief * reliefScale);
  const commPenalty = Math.round(signal.penalty * penaltyScale);
  if (commRelief > 0) {
    notes.push({
      delta: -commRelief,
      reason: reliefReason(text, symptom, repeated),
      category: "communication",
    });
  }
  if (commPenalty > 0) {
    notes.push({ delta: commPenalty, reason: penaltyReason(text, symptom), category: "communication" });
  }
  if (symptom === "dyspnea" && text.split(/\s+/).filter(Boolean).length > 42 && !/ossigen|fiato|respiro/.test(text)) {
    notes.push({
      delta: 6,
      reason: "Troppe domande di fila mentre gli manca il fiato",
      category: "communication",
    });
  }

  if (profile.reactivityType === "hypo" && turnsWithoutLifesaving > 0 && !isLifesavingMet(profile, completed)) {
    notes.push({
      delta: Math.round(5 * turnsWithoutLifesaving),
      reason: "Peggioramento clinico per ritardo negli interventi",
      category: "deterioration",
    });
  }

  if (newExamId) {
    const examHaystack = `${newExamId} ${newExamName ?? ""}`;
    if (isDangerousPrescription(newExamId, newExamName, text, profile) || riskyPrescription) {
      notes.push({ delta: 25, reason: "Un intervento che non si aspetta lo agita", category: "clinical_action" });
    } else if (isRelievingExam(newExamId, newExamName, profile, goldStandardPath)) {
      const oxygen = /ossigen|o2|venturi|broncodilat|salbutam|ega/i.test(examHaystack);
      notes.push({
        delta: -12,
        reason:
          symptom === "dyspnea" || oxygen
            ? "Ossigenoterapia/intervento mirato: respiro meno affannoso"
            : symptom === "chest"
              ? "Un controllo mirato sul petto lo rassicura"
              : "Un passo clinico pertinente lo rassicura",
        category: "clinical_action",
      });
    } else if (/cateter|emogas|puncion/i.test(examHaystack) || isInvasiveExam(newExamId, newExamName)) {
      const explained = EXPLAINS.test(text) || CONSENT.test(text);
      notes.push({
        delta: explained ? 3 : 10,
        reason: explained ? "La manovra è stata spiegata prima" : "Manovra dolorosa eseguita senza preavviso",
        category: "clinical_action",
      });
    }
  }

  if (painfulManeuver) {
    const explained = EXPLAINS.test(text) || CONSENT.test(text);
    notes.push({
      delta: explained ? 2 : Math.round(8 * penaltyFactor(profile.reactivityType)),
      reason: explained ? "La manovra è stata spiegata prima" : "Manovra dolorosa eseguita senza preavviso",
      category: "clinical_action",
    });
  }

  if (!repeated) {
    for (const key of profile.criticalMilestones.reduceStress) {
      if (completed.has(normalizeStepId(key)) || matchesMilestoneKey(key, text, newExamId, newExamName)) {
        notes.push({
          delta: matchesMilestoneKey(key, text, newExamId, newExamName) ? -12 : -6,
          reason: "Un passo che lo riguarda lo fa sentire seguito",
          category: "clinical_action",
        });
        completed.add(normalizeStepId(key));
      }
    }
  }
  for (const key of profile.criticalMilestones.increaseStress) {
    if (matchesMilestoneKey(key, text, newExamId, newExamName)) {
      const unexplained =
        key === "procedura_invasiva_non_spiegata" && !completed.has(normalizeStepId("consenso_informato"));
      notes.push({
        delta: unexplained ? 18 : 10,
        reason: unexplained ? "Manovra dolorosa eseguita senza preavviso" : "Il ritardo o la scelta lo rendono più teso",
        category: "clinical_action",
      });
    }
  }

  if (wrongDiagnosis) {
    notes.push({
      delta: profile.reactivityType === "hyper" ? 28 : 18,
      reason: "Una conclusione che non riconosce lo preoccupa",
      category: "diagnosis",
    });
  }

  let next = before + notes.reduce((sum, note) => sum + note.delta, 0);
  if (floor > 0) next = Math.max(next, floor);
  const stress = clampStress(next);
  const delta = stress - before;
  const chosen = pickNote(notes, delta);
  return {
    stress,
    delta,
    reason: chosen.reason,
    category: chosen.category,
    severity: stressSeverity(stress),
  };
}

export function temporalStressEvent(
  current: number,
  profile: StressProfile,
  elapsedMinutes = 1,
  options?: TemporalDriftOptions,
): StressTurnEvent {
  const stress = computeTemporalStressDrift(current, profile, elapsedMinutes, options);
  const delta = stress - Math.round(current);
  const rising = delta > 0 && options?.acuteUntreated;
  return {
    stress,
    delta,
    reason: rising
      ? "Peggioramento clinico per ritardo negli interventi"
      : delta > 0
        ? "Il tempo passa e il disagio sale leggermente"
        : "Il tempo passa, il paziente resta stabile",
    category: rising ? "deterioration" : "time",
    severity: stressSeverity(stress),
  };
}

export type TemporalDriftOptions = {
  /** Acute illness still without a gold-standard or life-saving action. */
  acuteUntreated?: boolean;
  /** Stable patient with no acute driver: passive climb stays near zero. */
  allianceStable?: boolean;
  /** Pathological floor the drift may climb toward, never past, when untreated. */
  floor?: number;
};

/**
 * Simulated-minute drift. Untreated acute cases use `timeDecayRate`.
 * A stable or allied patient does not climb to 100 just because time passes.
 * Omitting `options` keeps the legacy full-rate drift.
 */
export function computeTemporalStressDrift(
  current: number,
  profile: StressProfile,
  elapsedMinutes = 1,
  options?: TemporalDriftOptions,
): number {
  const minutes = Math.max(0, elapsedMinutes);
  let rate = profile.timeDecayRate;
  if (options?.acuteUntreated) {
    rate = profile.reactivityType === "hypo" ? Math.max(rate, 2.5) : rate;
  } else if (options) {
    if (options.allianceStable || profile.reactivityType === "standard") rate = 0.05;
    else if (profile.reactivityType === "hyper") rate = Math.min(0.4, rate * 0.15);
    else rate = Math.min(0.25, rate * 0.08);
  }
  let next = current + rate * minutes;
  const floor = options?.floor ?? 0;
  if (options?.acuteUntreated && floor > 0 && next < floor) {
    next = Math.min(floor, current + Math.max(rate, 1) * minutes);
  }
  return clampStress(next);
}

export function isAcuteUntreated(params: {
  profile: StressProfile;
  description?: string;
  painNrs?: number | null;
  spo2?: number | null;
  systolic?: number | null;
  completedMilestoneKeys?: string[];
  requestedExamIds?: string[];
  goldStandardPath?: string[];
}): boolean {
  const completed = milestoneSet(params.completedMilestoneKeys);
  const treated =
    isLifesavingMet(params.profile, completed) ||
    (params.requestedExamIds ?? []).some((examId) =>
      isRelievingExam(examId, undefined, params.profile, params.goldStandardPath),
    );
  return (
    pathologicalStressFloor({
      profile: params.profile,
      painNrs: params.painNrs,
      spo2: params.spo2,
      systolic: params.systolic,
      description: params.description,
      treated,
    }) > 0
  );
}

/** @deprecated Use {@link computeTemporalStressDrift}. */
export function computeIdleStressDrift(current: number, profile: StressProfile): number {
  return computeTemporalStressDrift(current, profile, 1);
}

/** Detect milestone keys triggered by the latest user turn (client-safe). */
export function detectStressMilestonesFromTurn(params: {
  profile: StressProfile;
  userMessage?: string;
  examId?: string;
  examName?: string;
}): string[] {
  const msg = params.userMessage ?? "";
  const keys: string[] = [];
  const all = [
    ...params.profile.criticalMilestones.reduceStress,
    ...params.profile.criticalMilestones.increaseStress,
    ...(params.profile.lifesavingMilestones ?? []),
  ];
  for (const key of all) {
    if (matchesMilestoneKey(key, msg, params.examId, params.examName)) {
      keys.push(key);
    }
  }
  if (params.examId && isRelievingExam(params.examId, params.examName, params.profile)) {
    const canon = resolveCanonicalExam(params.examId, params.examName);
    if (canon) keys.push(canon.milestoneKey);
  }
  return [...new Set(keys)];
}
