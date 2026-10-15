export type ExamLatenciesMap = Record<string, number>;

/**
 * Catalog ids differ from the authored step id:
 * coprocultura is the menu id, coprocoltura the clinical spelling;
 * tc is the single CT order, tc-addome the abdominal study.
 */
const GOLD_STEP_ORDER_ALIASES: Record<string, readonly string[]> = {
  coprocoltura: ["coprocultura"],
  "tc-addome": ["tc"],
};

/** Normalizes step/exam ids for fuzzy matching (rx_torace ↔ rx-torace). */
export function normalizeStepId(id: string): string {
  return id.trim().toLowerCase().replace(/[\s_]+/g, "-");
}

export function parseExamLatencies(raw: unknown): ExamLatenciesMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const map: ExamLatenciesMap = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) {
      map[normalizeStepId(key)] = Math.round(n);
    }
  }
  return map;
}

export function parseGoldStandardPath(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((s): s is string => typeof s === "string" && s.trim().length > 0);
}

export function computeElapsedMinutesFromExams(
  requestedExamIds: string[],
  examLatencies: ExamLatenciesMap,
  fallbackMinutes = 5,
): number {
  let total = 0;
  const seen = new Set<string>();

  for (const examId of requestedExamIds) {
    const key = normalizeStepId(examId);
    if (seen.has(key)) continue;
    seen.add(key);

    const direct = examLatencies[key];
    if (direct != null) {
      total += direct;
      continue;
    }

    const fuzzy = Object.entries(examLatencies).find(
      ([k]) => key.includes(k) || k.includes(key),
    );
    total += fuzzy?.[1] ?? fallbackMinutes;
  }

  return total;
}

export function inferCompletedGoldSteps(params: {
  goldStandardPath: string[];
  requestedExamIds: string[];
  clientCompletedSteps?: string[];
  lastUserMessage?: string;
}): string[] {
  const completed = new Set(
    (params.clientCompletedSteps ?? []).map(normalizeStepId),
  );

  const msg = (params.lastUserMessage ?? "").toLowerCase();

  for (const step of params.goldStandardPath) {
    const norm = normalizeStepId(step);
    if (completed.has(norm)) continue;

    if (
      params.requestedExamIds.some((e) => {
        const exam = normalizeStepId(e);
        if (exam === norm || exam.includes(norm) || norm.includes(exam)) return true;
        const aliases = GOLD_STEP_ORDER_ALIASES[norm] ?? [];
        return aliases.some((alias) => normalizeStepId(alias) === exam);
      })
    ) {
      completed.add(norm);
      continue;
    }

    if (norm.includes("anamnesi") && /fum|anamnes|chied|stor|drog|alcol|sonno|cefalea/i.test(msg)) {
      completed.add(norm);
    }
    if (norm.includes("parametri") && /parametr|pression|saturaz|vital|fc\b|spo2/i.test(msg)) {
      completed.add(norm);
    }
    if (norm === "nihss" && /nihss|scala.{0,12}ictus|punteggio neurolog/i.test(msg)) {
      completed.add(norm);
    }
    if (norm.includes("trombolisi") && /trombol|alteplas|rt-?pa|fibrinolis/i.test(msg)) {
      completed.add(norm);
    }
    if (norm.includes("patente") && /patente|motorizzaz|sospension.{0,20}guid/i.test(msg)) {
      completed.add(norm);
    }
    if (norm.includes("lorazepam") && /lorazepam|benzodiazepin/i.test(msg)) completed.add(norm);
    if (norm.includes("fenitoina") && /fenitoina|fosfenitoina/i.test(msg)) completed.add(norm);
    if (norm.includes("intubazione") && /intub|propofol/i.test(msg)) completed.add(norm);
    if (norm.includes("aciclovir") && /aciclovir|antivirale/i.test(msg)) completed.add(norm);
    if (norm.includes("eparina") && /eparina|enoxaparina|anticoagul/i.test(msg)) completed.add(norm);
    if (norm.includes("carbamazepina") && /carbamazepina|oxcarbazepina/i.test(msg)) completed.add(norm);
    if (norm.includes("levodopa") && /levodopa|l-dopa|madopar|sinemet/i.test(msg)) completed.add(norm);
    if (norm.includes("immunoglobulin") && /immunoglobulin|plasmaferesi/i.test(msg)) completed.add(norm);
    if (norm.includes("antiaggregante") && /aspirina|clopidogrel|antiaggreg/i.test(msg)) completed.add(norm);
    if (norm.includes("triptan") && /triptan|sumatriptan|almotriptan/i.test(msg)) completed.add(norm);
    if (
      (norm.includes("dix") || norm.includes("epley") || norm.includes("hallpike")) &&
      /dix|hallpike|epley|riposizion/i.test(msg)
    ) {
      completed.add(norm);
    }
    if (norm.includes("abcd2") && /abcd/i.test(msg)) completed.add(norm);
    if (norm.includes("piede") && /piede diabet|prevenzione del piede|ispezione dei piedi/i.test(msg)) {
      completed.add(norm);
    }
    if (norm.includes("colloquio") && /prognosi|aspettativa di vita|comunicazione/i.test(msg)) {
      completed.add(norm);
    }
    if (norm.includes("obiettivo") && /auscult|palp|obiettiv|esamin/i.test(msg)) completed.add(norm);
    if (norm.includes("ossigeno") && /ossigen|o2|mascher/i.test(msg)) completed.add(norm);
    if (
      norm.includes("terapia") &&
      /somministr|terapia|farmaco|fluid|prescritt|azione_medica/i.test(msg)
    ) {
      completed.add(norm);
    }
    if (msg.includes("[azione_medica: prescrizione]") && /farmac|prescri|terap/i.test(norm)) {
      completed.add(norm);
    }
    if (infectiousStepMatches(norm, msg)) {
      completed.add(norm);
    }
  }

  return Array.from(completed);
}

/** Gold step id → drugs or actions that complete it from chat or a prescription trace. */
const INFECTIOUS_STEP_RULES: ReadonlyArray<{ step: RegExp; message: RegExp }> = [
  { step: /fosfomicina|nitrofurantoina|antibiotico-cistite/, message: /fosfomicin|nitrofurantoin|monuril|furadantin/ },
  { step: /analgesic/, message: /paracetamol|tachipirina|ibuprofen|fans|analgesic/ },
  { step: /idratazione|fluidi/, message: /idrat|reidrat|fisiologic|ringer|fluid|riempiment/ },
  { step: /vancomicina/, message: /vancomic|vancocin/ },
  { step: /artesunat|artemisinin/, message: /artesunat|artemisinin|artemeter|riamet/ },
  { step: /ceftriaxone/, message: /ceftriaxon|rocefin/ },
  { step: /penicillin|cefazolin/, message: /penicillin|benzilpenicillin|cefazolin|amoxicillin/ },
  { step: /doxiciclin/, message: /doxiciclin|bassado/ },
  { step: /desametason/, message: /desametason|dexametason/ },
  { step: /meropenem/, message: /meropenem/ },
  { step: /clindamicin/, message: /clindamicin|dalacin/ },
  { step: /daptomicin/, message: /daptomicin|cubicin/ },
  { step: /piperacillin|tazobactam/, message: /piperacillin|tazobactam|tazocin|piptazo/ },
  { step: /sbrigliamento/, message: /sbrigliament|debridement|chirurgo|sala operatoria/ },
  { step: /rimozione-cvc|rimozione/, message: /rimuov|rimozion|tolgo il cateter|sfilo il cateter|catetere rimosso/ },
  { step: /isolamento/, message: /isolament|camera singola|protettiv/ },
  { step: /notifica-asl/, message: /notific|a\.?s\.?l|profilassi dei contatt/ },
  { step: /consenso-hiv/, message: /consenso.{0,40}hiv|hiv.{0,40}consenso|legge\s*135/ },
];

function infectiousStepMatches(norm: string, msg: string): boolean {
  return INFECTIOUS_STEP_RULES.some((rule) => rule.step.test(norm) && rule.message.test(msg));
}

export function isGoldStandardMet(
  goldStandardPath: string[],
  completedSteps: string[],
): boolean {
  // Empty / absent gold path is NOT "met" — otherwise deterioration never fires
  // and incomplete beta cases look clinically complete.
  if (!goldStandardPath.length) return false;
  const done = new Set(completedSteps.map(normalizeStepId));
  return goldStandardPath.every((step) => done.has(normalizeStepId(step)));
}

export function buildDeteriorationInstruction(params: {
  elapsedMinutes: number;
  threshold: number | null | undefined;
  goldStandardMet: boolean;
}): string | null {
  const { elapsedMinutes, threshold, goldStandardMet } = params;
  if (!threshold || goldStandardMet || elapsedMinutes < threshold) return null;

  return `
**DETERIORAMENTO CLINICO ATTIVO (tempo simulato: ${elapsedMinutes} min — soglia ${threshold} min superata senza azioni salvavita dal Gold Standard):**
Il paziente sta peggiorando progressivamente. DEVI riflettere questo nelle risposte:
- Respiro più affannoso, frasi spezzate; se ipossia: "non riesco a respirare bene"
- SpO₂ in calo (desatura), pressione arteriosa in calo, tachicardia crescente
- Dolore/intensità sintomi in aumento; ansia marcata
- NON rivelare valori numerici dei parametri vitali a meno che il medico non li misuri di nuovo
- Se lo stress era < 90, portalo verso 90+ nelle tue reazioni`.trim();
}
