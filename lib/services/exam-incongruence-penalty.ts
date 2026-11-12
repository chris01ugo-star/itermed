/**
 * Penalità di appropriatezza per esame incongruente.
 * Basso costo/rischio −5%, costoso o fuori indicazione −15%,
 * invasivo e controindicato −40% con killer switch.
 */
export const EXAM_PENALTY_LOW_PERCENT = 5;
export const EXAM_PENALTY_COSTLY_PERCENT = 15;
export const EXAM_PENALTY_FATAL_PERCENT = 40;

/** Sotto questa tariffa un esame inutile resta a basso costo (emocromo, stick, ECG di controllo). */
export const LOW_WASTE_EURO_CEILING = 80;

const COSTLY_EXAM =
  /tc\s*total|tac\s*total|total[\s-]*body|rm\s*(total|total[\s-]*body|encefal)|pet\b|scintigraf|coronarograf/i;

const FATAL_EXAM =
  /((mezzo di contrasto|mdc|contrasto iodato).{0,80}(insufficienza renale|egfr|creatinin|controindic))|((insufficienza renale|egfr\s*<\s*30|controindic).{0,80}(contrasto|mdc|mezzo di contrasto))|(invasiv\w*.{0,50}controindic)|(controindic\w*.{0,50}invasiv)/i;

export type ExamPenaltyTier = "low" | "costly" | "fatal";

export type ExamPenaltyDecision = {
  percent: 5 | 15 | 40;
  tier: ExamPenaltyTier;
  triggersKillerSwitch: boolean;
  rationale: string;
};

export function classifyIncongruentExamPenalty(input: {
  wasteEuro?: number | null;
  isFatal?: boolean | null;
  name?: string | null;
  description?: string | null;
}): ExamPenaltyDecision {
  const text = `${input.name ?? ""} ${input.description ?? ""}`.trim();
  if (input.isFatal === true || FATAL_EXAM.test(text)) {
    return {
      percent: EXAM_PENALTY_FATAL_PERCENT,
      tier: "fatal",
      triggersKillerSwitch: true,
      rationale:
        "Esame invasivo e controindicato: penalità 40% e killer switch (es. mezzo di contrasto in insufficienza renale severa).",
    };
  }

  const waste = Number(input.wasteEuro);
  const costlyByPrice = Number.isFinite(waste) && waste >= LOW_WASTE_EURO_CEILING;
  if (costlyByPrice || COSTLY_EXAM.test(text)) {
    return {
      percent: EXAM_PENALTY_COSTLY_PERCENT,
      tier: "costly",
      triggersKillerSwitch: false,
      rationale: "Esame costoso o inappropriato (es. TC Total Body inutile): penalità 15%.",
    };
  }

  return {
    percent: EXAM_PENALTY_LOW_PERCENT,
    tier: "low",
    triggersKillerSwitch: false,
    rationale: "Esame inutile a basso costo e basso rischio (es. emocromo extra): penalità 5%.",
  };
}
