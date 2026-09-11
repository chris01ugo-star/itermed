-- AlterTable
ALTER TABLE "CaseSession" ADD COLUMN IF NOT EXISTS "prescribedMedications" JSONB;
