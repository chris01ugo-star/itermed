import { z } from "zod";
import { CaseImportSchema } from "@/lib/cases/case-import-schema";
import { GoldStandardPathSchema } from "@/lib/cases/case-creator-schemas";

export const MatrixFrequencySchema = z.enum(["HIGH", "MEDIUM", "LOW"]);
export const MatrixDifficultySchema = z.enum(["BASE", "INTERMEDIATE", "ADVANCED"]);
export const CaseSettingSchema = z.enum([
  "GUARDIA_MEDICA",
  "PRONTO_SOCCORSO",
  "AMBULATORIO",
  "REPARTO",
]);

export const KbAnamnesisQuestionSchema = z.object({
  id: z.string().min(2).max(80),
  prompt: z.string().min(8).max(400),
  critical: z.boolean(),
  expectedKeywords: z.array(z.string().min(2).max(80)).min(2).max(10),
  rationale: z.string().min(10).max(500),
});

export const KbExamFindingSchema = z.object({
  examId: z.string().min(1).max(80),
  name: z.string().min(2).max(160).optional(),
  finding: z.string().min(10).max(1200),
  isAbnormal: z.boolean(),
  priceEuro: z.number().min(0).optional(),
  inappropriate: z.boolean().optional(),
  wasteRationale: z.string().max(500).optional(),
});

export const KbEscCitationSchema = z.object({
  chunkId: z.string().min(1).max(120),
  source: z.string().min(3).max(240),
  quote: z.string().min(20).max(800),
});

const KbBaselineExamFindingsSchema = z
  .object({
    vitals: z.object({
      heartRate: z.union([z.number(), z.string()]),
      bloodPressure: z.string().min(3),
      spo2: z.union([z.number(), z.string()]),
      temperature: z.union([z.number(), z.string()]),
      respiratoryRate: z.union([z.number(), z.string()]),
    }),
    examBudgetEuro: z.number().positive().optional(),
    advancedExams: z
      .object({
        values: z.record(
          z.string().min(1),
          z
            .object({
              finding: z.string().min(1).optional(),
              normalFinding: z.string().min(1).optional(),
              isAbnormal: z.boolean().optional(),
              price: z.number().optional(),
            })
            .passthrough(),
        ),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

/**
 * Structured cardiology case authored from `knowledge_base/cardiologia/matrix.json`.
 * Compatible with `CaseImportSchema` / `assertPlayableCase` (playable baseline).
 */
export const KnowledgeBaseCaseSchema = CaseImportSchema.extend({
  id: z.string().regex(/^CARDIO-\d{3}$/),
  code: z.string().regex(/^CARDIO-\d{3}$/),
  specialty: z.literal("cardiologia"),
  specialtyLabel: z.literal("Cardiologia"),
  condition: z.string().min(3).max(240),
  frequencyCategory: MatrixFrequencySchema,
  matrixDifficulty: MatrixDifficultySchema,
  setting: CaseSettingSchema,
  guidelineRef: z.string().min(8).max(200),
  diagnosis: z.string().min(5).max(500),
  pastMedicalHistory: z.string().min(20).max(4000),
  presentation: z.string().min(40).max(4000),
  redHerrings: z.array(z.string().min(8).max(400)).min(2).max(8),
  timeLimitMinutes: z.number().int().min(5).max(480),
  patientDeteriorationThreshold: z.number().int().min(1).max(480),
  examLatencies: z.record(z.string().min(1).max(80), z.number().int().min(0).max(10_000)),
  anamnesisQuestions: z.array(KbAnamnesisQuestionSchema).min(4).max(10),
  physicalExam: z.object({
    killipClass: z.enum(["I", "II", "III", "IV"]),
    summary: z.string().min(20).max(1500),
  }),
  goldPathNarrative: z.string().min(40).max(2500),
  escCitations: z.array(KbEscCitationSchema).min(1).max(8),
  auditMetrics: z.object({
    appropriatenessIndicators: z.array(z.string().min(8).max(400)).min(2).max(10),
    gelliBiancoShield: z.object({
      art5Adherence: z.string().min(20).max(1000),
      legalCriteria: z.array(z.string().min(8).max(400)).min(2).max(8),
    }),
  }),
  mandatoryExams: z.array(KbExamFindingSchema).min(2).max(12),
  inappropriateExams: z.array(KbExamFindingSchema).min(1).max(6),
  baselineExamFindings: KbBaselineExamFindingsSchema,
});

export type KnowledgeBaseCase = z.infer<typeof KnowledgeBaseCaseSchema>;

/** Flat LLM payload — nested arrays break OpenAI structured output too often. */
export const GeneratedCaseNarrativeSchema = z.object({
  age: z.number(),
  sex: z.enum(["M", "F"]),
  name: z.string(),
  context: z.string(),
  heartRate: z.number(),
  bloodPressure: z.string(),
  spo2: z.number(),
  temperature: z.number(),
  respiratoryRate: z.number(),
  description: z.string(),
  presentation: z.string(),
  redHerring1: z.string(),
  redHerring2: z.string(),
  redHerring3: z.string(),
  pastMedicalHistory: z.string(),
  patientPrompt: z.string(),
  diagnosis: z.string(),
  correctSolution: z.string(),
  goldPathNarrative: z.string(),
  physicalExamSummary: z.string(),
  examAbnormalitiesSummary: z.string(),
  killipClass: z.enum(["I", "II", "III", "IV"]),
  gelliArt5Adherence: z.string(),
});

export type GeneratedCaseNarrative = z.infer<typeof GeneratedCaseNarrativeSchema>;

export const MATRIX_TO_ENGINE_DIFFICULTY = {
  BASE: "EASY",
  INTERMEDIATE: "MEDIUM",
  ADVANCED: "HARD",
} as const satisfies Record<z.infer<typeof MatrixDifficultySchema>, "EASY" | "MEDIUM" | "HARD">;

export { GoldStandardPathSchema };
