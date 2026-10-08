-- AlterTable
ALTER TABLE "CaseSession" ADD COLUMN IF NOT EXISTS "failedDiagnosisAttempts" INTEGER NOT NULL DEFAULT 0;
