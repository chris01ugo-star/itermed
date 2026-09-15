import { z } from "zod";
import { ADMINISTRATION_ROUTES } from "@/lib/simulator/prescription-trace";

export const MedicationListQuerySchema = z.object({
  q: z.string().max(120).optional(),
  category: z.string().max(80).optional(),
  take: z.coerce.number().int().min(1).max(80).optional(),
});

export const PrescribeMedicationBodySchema = z.object({
  sessionId: z.string().min(1),
  caseId: z.string().min(1).optional(),
  medicationId: z.string().min(1),
  route: z.enum(ADMINISTRATION_ROUTES),
  posology: z.string().trim().min(1).max(200),
});
