import { z } from "zod";

/**
 * Clean Zod schemas for OpenAI structured outputs (strict mode).
 * Do NOT use z.preprocess / ZodEffects here — they drop fields from JSON Schema
 * `required`, and OpenAI then rejects the tool schema.
 */

export const LegalProtectionStatusSchema = z.object({
  status: z.enum(["PROTECTED", "PARTIALLY_EXPOSED", "HIGHLY_EXPOSED"]),
  justification: z.string().max(800),
  referenceDocuments: z.array(z.string().max(120)).max(12),
});

export const ClinicalDeltaRowSchema = z.object({
  protocolAction: z.string().max(200),
  userAction: z.string().max(200),
  status: z.enum(["MET", "MISSED", "DELAYED"]),
  penaltyOrBonusReason: z.string().max(320),
});

export const EconomicExpenseSchema = z.object({
  examName: z.string().max(120),
  cost: z.number().min(0),
  reason: z.string().max(280),
});

export const EconomicAnalysisSchema = z.object({
  targetBudget: z.number().min(0),
  actualSpent: z.number().min(0),
  unnecessaryExpenses: z.array(EconomicExpenseSchema).max(15),
  missedRequiredExams: z.array(EconomicExpenseSchema).max(15),
});

export const CoachingFeedbackSchema = z.object({
  empatia: z.string().max(400),
  tutelaLegale: z.string().max(400),
  economicita: z.string().max(400),
  accuratezza: z.string().max(400),
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
