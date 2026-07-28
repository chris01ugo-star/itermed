import { z } from "zod";

/** GPT-4o often emits null instead of omitting optional arrays — coerce to []. */
function nullishStringArray(itemMax: number, listMax: number) {
  return z.preprocess((value) => {
    if (value == null) return [];
    if (!Array.isArray(value)) return [];
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.slice(0, itemMax));
  }, z.array(z.string().max(itemMax)).max(listMax));
}

/** Truncate overlong model strings so .max() validation does not abort the report. */
function cappedString(max: number, fallback = "") {
  return z.preprocess((value) => {
    if (value == null) return fallback;
    const text = typeof value === "string" ? value : String(value);
    return text.length > max ? text.slice(0, max) : text;
  }, z.string().max(max));
}

export const LegalProtectionStatusSchema = z.object({
  status: z.enum(["PROTECTED", "PARTIALLY_EXPOSED", "HIGHLY_EXPOSED"]),
  justification: cappedString(800),
  referenceDocuments: nullishStringArray(120, 12),
});

export const ClinicalDeltaRowSchema = z.object({
  protocolAction: cappedString(200),
  userAction: cappedString(200),
  status: z.enum(["MET", "MISSED", "DELAYED"]),
  penaltyOrBonusReason: cappedString(320),
});

export const EconomicExpenseSchema = z.object({
  examName: cappedString(120),
  cost: z.preprocess((value) => {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }, z.number().min(0)),
  reason: cappedString(280),
});

function nullishExpenseArray(listMax: number) {
  return z.preprocess((value) => {
    if (value == null) return [];
    return Array.isArray(value) ? value : [];
  }, z.array(EconomicExpenseSchema).max(listMax));
}

export const EconomicAnalysisSchema = z.object({
  targetBudget: z.preprocess((value) => {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }, z.number().min(0)),
  actualSpent: z.preprocess((value) => {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }, z.number().min(0)),
  unnecessaryExpenses: nullishExpenseArray(15),
  missedRequiredExams: nullishExpenseArray(15),
});

export const CoachingFeedbackSchema = z.object({
  empatia: cappedString(400),
  tutelaLegale: cappedString(400),
  economicita: cappedString(400),
  accuratezza: cappedString(400),
});

export type LegalProtectionStatus = z.infer<typeof LegalProtectionStatusSchema>;
export type ClinicalDeltaRow = z.infer<typeof ClinicalDeltaRowSchema>;
export type EconomicAnalysis = z.infer<typeof EconomicAnalysisSchema>;
export type CoachingFeedback = z.infer<typeof CoachingFeedbackSchema>;

/** Clinically fatal error that triggers the Killer Switch grade cap. */
export type FatalError = {
  description: string;
  rationale: string;
};

export type MacroAreaScore = {
  key: "clinical" | "legal" | "economy" | "empathy";
  label: string;
  shortLabel: string;
  weightPercent: number;
  scorePercent: number;
  contributionTrentesimi: number;
  rationale: string;
};

export type ReportDashboardPayload = {
  version: 1;
  finalScore: number;
  rawScore: number;
  killerSwitchApplied: boolean;
  macroAreas: MacroAreaScore[];
  radarData: Array<{ metric: string; score: number; fullMark: number }>;
  fatalErrors: FatalError[];
};

export type ClinicalGapItem = {
  errorOrOmission: string;
  scientificGap: string;
  vividDamageScenario: string;
  clinicalRiskLevel: "BASSO" | "MEDIO" | "ALTO" | "CATASTROFICO";
};

export type ForensicLegalAssessment = {
  legalFramework: string;
  culpabilityProfile: string;
  materialCausality: string;
};

export type GoldStandardGuide = {
  perfectClinicalPathway: string;
  pathophysiologyContext: string;
  formalGuidelineCitations: string[];
};
