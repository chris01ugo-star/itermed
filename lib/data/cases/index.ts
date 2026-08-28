export type {
  AnamnesisQuestion,
  CaseCategory,
  CaseExamDefinition,
  ClinicalCase,
  ClinicalCaseDifficulty,
  HealthLiteracy,
  LegalConformityCriterion,
  PatientAdherence,
  PatientEmotionalState,
  PatientLifestyleAndSocial,
  PatientProfile,
  PhysicalExamDistrict,
  PrassiDifficultyLabel,
  RagLegalReference,
  SleepQuality,
  SocialSupport,
  StressLevel,
} from "@/lib/data/cases/types";

export { CAR_F01 } from "@/lib/data/cases/cardiologia/car-f01";
export { CAR_F02 } from "@/lib/data/cases/cardiologia/car-f02";
export { CAR_M01 } from "@/lib/data/cases/cardiologia/car-m01";
export { CAR_M02 } from "@/lib/data/cases/cardiologia/car-m02";
export { CAR_M03 } from "@/lib/data/cases/cardiologia/car-m03";
export { CAR_M04 } from "@/lib/data/cases/cardiologia/car-m04";
export { CAR_D01 } from "@/lib/data/cases/cardiologia/car-d01";
export { CAR_D02 } from "@/lib/data/cases/cardiologia/car-d02";
export { CAR_D03 } from "@/lib/data/cases/cardiologia/car-d03";
export { CAR_D04 } from "@/lib/data/cases/cardiologia/car-d04";
export { knowledgeBaseCaseToClinicalCase, clinicalCaseFromKnowledgeBaseRow } from "@/lib/data/cases/kb-mapper";

export {
  AUTHORED_CASE_REGISTRY,
  CASE_REGISTRY,
  GOLD_STANDARD_CASES,
  buildFallbackMapFromRegistry,
  getCaseById,
  getCaseRegistry,
  getGoldStandardCase,
  getPrassiRegistryCaseRows,
  getPrassiRegistrySpecialties,
  getRegisteredCase,
  isRegisteredCaseId,
  listRegisteredCases,
  clearCasesCache,
  normalizeCaseLookupKey,
  toClinicalCaseRow,
  toFallbackClinicalCase,
} from "@/lib/data/cases/registry";
