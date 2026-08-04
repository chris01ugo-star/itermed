export type ExamLatenciesMap = Record<string, number>;

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

    if (params.requestedExamIds.some((e) => normalizeStepId(e) === norm || normalizeStepId(e).includes(norm) || norm.includes(normalizeStepId(e)))) {
      completed.add(norm);
      continue;
    }

    if (norm.includes("anamnesi") && /fum|anamnes|chied|stor/i.test(msg)) completed.add(norm);
    if (norm.includes("obiettivo") && /auscult|palp|obiettiv|esamin/i.test(msg)) completed.add(norm);
    if (norm.includes("ossigeno") && /ossigen|o2|mascher/i.test(msg)) completed.add(norm);
    if (norm.includes("terapia") && /somministr|terapia|farmaco|fluid/i.test(msg)) completed.add(norm);
  }

  return Array.from(completed);
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
