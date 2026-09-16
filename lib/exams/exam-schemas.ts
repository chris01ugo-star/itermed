import { z } from "zod";

export const DiagnosticExamCategorySchema = z.enum([
  "IMAGING",
  "INSTRUMENTAL",
  "ENDOSCOPY",
  "LAB",
]);

export const ExamMetadataCreateSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "id must be lowercase alphanumeric with hyphens"),
  name: z.string().min(1).max(200),
  category: z.string().min(1).max(120),
  unit: z.string().max(40).default(""),
  normalRangeMin: z.number().nullable().optional(),
  normalRangeMax: z.number().nullable().optional(),
  baseCost: z.number().min(0).max(100_000),
  baseTurnaroundMinutes: z.number().int().min(0).max(100_000),
  urgencyTiming: z.string().max(40).default("n.p."),
  routineTiming: z.string().max(40).default("n.p."),
  normalFindingText: z.string().max(280).default(""),
});

export const ExamMetadataUpdateSchema = ExamMetadataCreateSchema.omit({ id: true }).partial();

export const ExamListQuerySchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
});

export type ExamMetadataDto = z.infer<typeof ExamMetadataCreateSchema>;
