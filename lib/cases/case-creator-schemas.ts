import { z } from "zod";
import { ClinicalSignSchema } from "@/lib/clinical/clinical-signs";

const vitalsSchema = z.object({
  heartRate: z.union([z.number(), z.string()]).optional().nullable(),
  bloodPressure: z.string().optional().nullable(),
  spo2: z.union([z.number(), z.string()]).optional().nullable(),
  temperature: z.union([z.number(), z.string()]).optional().nullable(),
  respiratoryRate: z.union([z.number(), z.string()]).optional().nullable(),
});

const demographicsSchema = z.object({
  age: z.union([z.number(), z.string()]).optional().nullable(),
  sex: z.enum(["M", "F", ""]).optional().nullable(),
  context: z.string().max(500).optional().nullable(),
});

export const ExamLatenciesSchema = z
  .record(z.string().min(1).max(80), z.number().int().min(0).max(10_000))
  .optional()
  .nullable();

export const GoldStandardPathSchema = z
  .array(z.string().min(1).max(120))
  .min(1, "Inserisci almeno una tappa del Gold Standard")
  .max(40);

export const AdvancedCaseCreateSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(4000),
  specialty: z.string().max(120).optional().nullable(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).default("MEDIUM"),
  pastMedicalHistory: z.string().max(4000).optional().nullable(),
  correctSolution: z.string().max(4000).optional().nullable(),
  isGlobal: z.boolean().optional().default(false),
  demographics: demographicsSchema.optional(),
  vitals: vitalsSchema.optional(),
  clinicalSigns: z.array(ClinicalSignSchema).max(40).optional(),
  patientPrompt: z.string().max(4000).optional().nullable(),
  timeLimitMinutes: z.number().int().min(5).max(480).optional().nullable(),
  goldStandardPath: GoldStandardPathSchema,
  examLatencies: ExamLatenciesSchema,
  patientDeteriorationThreshold: z.number().int().min(1).max(480).optional().nullable(),
});

export type AdvancedCaseCreateInput = z.infer<typeof AdvancedCaseCreateSchema>;
