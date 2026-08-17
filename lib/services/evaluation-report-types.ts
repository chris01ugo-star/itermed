import { z } from "zod";

/**
 * Clean Zod schemas for OpenAI structured outputs (strict mode).
 * Do NOT use z.preprocess / ZodEffects here — they drop fields from JSON Schema
 * `required`, and OpenAI then rejects the tool schema.
 */

export const LegalProtectionStatusSchema = z.object({
  status: z.enum(["PROTECTED", "PARTIALLY_EXPOSED", "HIGHLY_EXPOSED"]),
  justification: z.string().max(1200).nullable(),
  referenceDocuments: z.array(z.string().max(200)).max(12).nullable(),
});

export const ClinicalDeltaRowSchema = z.object({
  protocolAction: z.string().max(280),
  userAction: z.string().max(280).nullable(),
  status: z.enum(["MET", "MISSED", "DELAYED"]),
  penaltyOrBonusReason: z.string().max(480).nullable(),
});

export const EconomicExpenseSchema = z.object({
  examName: z.string().max(160),
  cost: z.number().min(0).nullable(),
  reason: z.string().max(400).nullable(),
});

export const EconomicAnalysisSchema = z.object({
  targetBudget: z.number().min(0).nullable(),
  actualSpent: z.number().min(0).nullable(),
  unnecessaryExpenses: z.array(EconomicExpenseSchema).max(15).nullable(),
  missedRequiredExams: z.array(EconomicExpenseSchema).max(15).nullable(),
});

export const CoachingFeedbackSchema = z.object({
  empatia: z.string().max(600).nullable(),
  tutelaLegale: z.string().max(600).nullable(),
  economicita: z.string().max(600).nullable(),
  accuratezza: z.string().max(600).nullable(),
});

export type LegalProtectionStatus = {
  status: "PROTECTED" | "PARTIALLY_EXPOSED" | "HIGHLY_EXPOSED";
  justification: string;
  referenceDocuments: string[];
};
export type ClinicalDeltaRow = {
  protocolAction: string;
  userAction: string;
  status: "MET" | "MISSED" | "DELAYED";
  penaltyOrBonusReason: string;
};
export type EconomicAnalysis = {
  targetBudget: number;
  actualSpent: number;
  unnecessaryExpenses: Array<{ examName: string; cost: number; reason: string }>;
  missedRequiredExams: Array<{ examName: string; cost: number; reason: string }>;
};
export type CoachingFeedback = {
  empatia: string;
  tutelaLegale: string;
  economicita: string;
  accuratezza: string;
};

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
