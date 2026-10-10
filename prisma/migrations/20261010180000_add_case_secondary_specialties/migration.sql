-- Cross-specialty retrieval: optional comorbidities on the clinical case.
ALTER TABLE "ClinicalCase" ADD COLUMN IF NOT EXISTS "secondarySpecialties" TEXT[] DEFAULT ARRAY[]::TEXT[];
