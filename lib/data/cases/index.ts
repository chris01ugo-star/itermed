export type {
  AnamnesisQuestion,
  CaseExamDefinition,
  ClinicalCase,
  ClinicalCaseDifficulty,
  LegalConformityCriterion,
  PhysicalExamDistrict,
  RagLegalReference,
} from "@/lib/data/cases/types";

export { CAR_F01 } from "@/lib/data/cases/cardiologia/car-f01";

import type { ClinicalCase } from "@/lib/data/cases/types";
import type { FallbackClinicalCase } from "@/lib/cases/fallback-cases";
import { CAR_F01 } from "@/lib/data/cases/cardiologia/car-f01";

/** All authored gold-standard cases (expand as specialties grow). */
export const GOLD_STANDARD_CASES: ClinicalCase[] = [CAR_F01];

export function getGoldStandardCase(codeOrId: string): ClinicalCase | undefined {
  const key = codeOrId.trim().toLowerCase();
  return GOLD_STANDARD_CASES.find(
    (c) => c.code.toLowerCase() === key || c.id.toLowerCase() === key,
  );
}

/** Adapt ClinicalCase → offline FallbackClinicalCase shape. */
export function toFallbackClinicalCase(c: ClinicalCase): FallbackClinicalCase {
  return {
    id: c.id,
    title: c.title,
    description: c.description,
    specialty: c.specialty,
    medicalSpecialtyKey: c.medicalSpecialtyKey,
    difficulty: c.difficulty,
    estimatedDurationMinutes: c.estimatedDurationMinutes,
    timeLimitMinutes: c.timeLimitMinutes,
    patientDeteriorationThreshold: c.patientDeteriorationThreshold,
    patientPrompt: c.patientPrompt,
    pastMedicalHistory: c.pastMedicalHistory,
    correctSolution: c.correctSolution,
    goldStandardPath: c.goldStandardPath,
    examLatencies: c.examLatencies,
    baselineExamFindings: c.baselineExamFindings,
  };
}
