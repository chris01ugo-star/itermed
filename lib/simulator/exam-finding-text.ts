/**
 * Play-time exam report text: drop leaked composites / clinical advice,
 * and reuse a related case finding (e.g. FAST ← ecografia) when the
 * requested exam has no dedicated override.
 */

export const RELATED_EXAM_IDS: Record<string, readonly string[]> = {
  fast: ["ecografia", "ecocolordoppler"],
  ecografia: ["ecocolordoppler"],
  ecocolordoppler: ["ecografia"],
  "rx-addome": ["ecografia"],
  angio: ["ecocolordoppler", "ecografia"],
  tc: ["ecografia"],
};

const EXAM_HINTS: Record<string, readonly string[]> = {
  fast: ["fast", "versamento", "morrison", "aorta", "aneurisma", "ecografia"],
  ecografia: ["ecografia", "eco ", "aneurisma", "aorta", "ascite", "colecist"],
  ecocolordoppler: ["ecocolordoppler", "doppler", "flusso", "aorta", "aneurisma"],
  emocromo: ["emocromo", "emoglobina", "anemia", "hb ", "plt", "leucocit"],
  "creat-urea-gfr": ["creatinina", "urea", "gfr", "azotemia", "renale"],
  ecg: ["ecg", "sinusale", "sopraslivell", "sottoslivell", "aritm", "stemi"],
  "troponina-hs": ["troponina"],
  "enzimi-epatici": ["ast", "alt", "ggt", "epatic"],
  bilirubina: ["bilirubina"],
  "amilasi-lipasi": ["amilasi", "lipasi"],
  "rx-torace": ["rx torace", "radiografia", "versamento pleuric", "parenchima"],
  ega: ["ega", "ph ", "po2", "pco2"],
};

function tokensFor(examId: string): string[] {
  return [examId.replace(/-/g, " "), ...(EXAM_HINTS[examId] ?? [])].map((t) =>
    t.toLowerCase(),
  );
}

function tidy(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/[.;]\s*$/g, "")
    .trim();
}

export function isWasteFinding(text: string): boolean {
  return /non di prima intenzione|spreco ssn/i.test(text);
}

export function isLeakedCompositeFinding(text: string): boolean {
  return (
    /nel contesto di\b/i.test(text) ||
    /\(\s*(cardio|pneumo|gastro)-\d{3}\s*\)/i.test(text) ||
    /\bda valutare\b/i.test(text) ||
    /\beseguire in sequenza\b/i.test(text) ||
    /\biniziare con\b/i.test(text)
  );
}

export function isAdviceFinding(text: string): boolean {
  return /\b(da valutare|eseguire|iniziare|programmare|si consiglia|occorre|bisogna|va richiesto|richiedere|seguire con|timing )\b/i.test(
    text,
  );
}

function splitClauses(text: string): string[] {
  return text
    .split(/[.;]\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function clauseMatchesExam(clause: string, examId: string): boolean {
  const lower = clause.toLowerCase();
  return tokensFor(examId).some((token) => lower.includes(token));
}

function isWrapperOrAdviceClause(clause: string): boolean {
  if (/nel contesto di/i.test(clause)) return true;
  if (/^\s*(eseguire|iniziare|programmare|seguire con|si consiglia)/i.test(clause)) {
    return true;
  }
  if (/\bda valutare\b/i.test(clause) && !/\d/.test(clause)) return true;
  if (/\(\s*(cardio|pneumo|gastro)-\d{3}\s*\)/i.test(clause) && clause.length < 80) {
    return true;
  }
  return false;
}

/** Keep only the requested exam's observation; drop other-exam hints and advice. */
export function sanitizeExamFinding(examId: string, raw: string): string {
  const source = tidy(raw);
  if (!source) return "";
  if (isWasteFinding(source)) return source;

  let text = source;
  if (isLeakedCompositeFinding(text) || isAdviceFinding(text)) {
    const clauses = splitClauses(text);
    const matched = clauses.filter((clause) => clauseMatchesExam(clause, examId));
    const pool = matched.length > 0 ? matched : clauses;
    const useful = pool.filter((clause) => !isWrapperOrAdviceClause(clause));
    text = useful.length > 0 ? useful.join(". ") : "";
  }

  text = text
    .replace(/\s*\(\s*(CARDIO|PNEUMO|GASTRO)-\d{3}\s*\)/gi, "")
    .replace(/\s*nel contesto di[^.;]*/gi, "")
    .replace(/\b(eseguire|iniziare|programmare|si consiglia)[^.;]*/gi, "")
    .replace(/\b[^.]*\bda valutare\b[^.]*\.?/gi, "");

  return tidy(text);
}

function aortaClause(finding: string): string | null {
  const clause = splitClauses(finding).find((part) =>
    /aorta|aneurisma|dilataz/i.test(part),
  );
  return clause ? tidy(clause) : null;
}

export function adaptFindingForRequestedExam(
  requestedId: string,
  sourceId: string,
  finding: string,
): string {
  const clean = tidy(finding);
  if (!clean) return "";
  if (requestedId === sourceId) return clean;

  if (requestedId === "fast") {
    const windows =
      "Finestre FAST (Morrison, splenorenale, pericardio, Douglas): assenza di versamento libero peri-epatico, splenico e pelvico";
    const aorta = aortaClause(clean);
    if (aorta) return tidy(`${windows}. ${aorta}`);
    if (/versamento/i.test(clean)) return clean;
    return tidy(`${windows}. ${clean}`);
  }

  return clean;
}

export function pickCaseFindingText(
  examId: string,
  caseValues: Record<string, { normalFinding?: string | null; finding?: string | null } | undefined>,
): { sourceId: string; text: string } | null {
  const own = caseValues[examId];
  const ownText = (own?.finding ?? own?.normalFinding)?.trim();
  if (ownText) return { sourceId: examId, text: ownText };

  for (const relatedId of RELATED_EXAM_IDS[examId] ?? []) {
    const related = caseValues[relatedId];
    const relatedText = (related?.finding ?? related?.normalFinding)?.trim();
    if (relatedText && !isWasteFinding(relatedText)) {
      return { sourceId: relatedId, text: relatedText };
    }
  }
  return null;
}
