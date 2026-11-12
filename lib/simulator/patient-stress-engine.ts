import { normalizeStepId } from "@/lib/cases/simulation-time";
import { isInvasiveExam, resolveCanonicalExam } from "@/lib/simulator/exam-canonical-registry";

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
}

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
  description?: string;
  treated?: boolean;
}): number {
  if (params.treated) return 0;
  const text = params.description ?? "";
  const pain = params.painNrs ?? 0;
  const spo2 = params.spo2 != null && params.spo2 > 0 ? params.spo2 : null;
  const shock =
    /shock|ipotens|sopor|coma/i.test(text) ||
    (params.systolic != null && params.systolic > 0 && params.systolic < 90);
  const severe = pain >= 9 || (spo2 != null && spo2 < 90) || shock;
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

/** Resolves per-case stress config from JSON baseline or clinical inference. */
export function resolveCaseStressProfile(params: {
  description: string;
  baselineExamFindings?: Record<string, unknown> | null;
  goldStandardPath?: string[];
}): StressProfile {
  const raw = params.baselineExamFindings?.stressProfile;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return normalizeStressProfile(raw as Record<string, unknown>, {
      description: params.description,
      goldStandardPath: params.goldStandardPath,
    });
  }
  return inferStressProfileFromCase(params.description, params.goldStandardPath);
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

/**
 * Core turn-based stress update — case profile, tone, milestones, prescriptions.
 */
export function computePatientStress(input: StressEngineInput): number {
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
    description,
    requestedExamIds = [],
    painfulManeuver,
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
    description,
    treated,
  });

  let next = input.currentStress > 0 ? input.currentStress : profile.initialStress;
  const signal = analyzeDoctorMessage(lastUserMessage, llmEmpathyDetected);
  const relief = Math.round(
    signal.relief * reliefFactor(profile.reactivityType) * diminishingRelief(next, floor),
  );
  const penalty = Math.round(signal.penalty * penaltyFactor(profile.reactivityType));
  next = next - relief + penalty;

  if (profile.reactivityType === "hypo" && turnsWithoutLifesaving > 0 && !isLifesavingMet(profile, completed)) {
    next += Math.round(5 * turnsWithoutLifesaving);
  }

  if (newExamId) {
    if (isDangerousPrescription(newExamId, newExamName, lastUserMessage ?? "", profile) || riskyPrescription) {
      next += 25;
    } else if (isRelievingExam(newExamId, newExamName, profile, goldStandardPath)) {
      next -= 12;
    } else if (/cateter|emogas|puncion/i.test(`${newExamId} ${newExamName ?? ""}`) || isInvasiveExam(newExamId, newExamName)) {
      const explained = EXPLAINS.test(lastUserMessage ?? "") || CONSENT.test(lastUserMessage ?? "");
      next += explained ? 3 : 10;
    }
  }

  if (painfulManeuver) {
    const explained = EXPLAINS.test(lastUserMessage ?? "") || CONSENT.test(lastUserMessage ?? "");
    next += explained ? 2 : Math.round(8 * penaltyFactor(profile.reactivityType));
  }

  next = applyCriticalMilestoneDeltas(next, profile, lastUserMessage ?? "", completed, newExamId, newExamName);

  if (wrongDiagnosis) {
    next += profile.reactivityType === "hyper" ? 28 : 18;
  }

  if (floor > 0) next = Math.max(next, floor);
  return clampStress(next);
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
