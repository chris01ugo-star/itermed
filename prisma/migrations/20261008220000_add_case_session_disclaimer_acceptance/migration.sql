-- AlterTable
ALTER TABLE "CaseSession" ADD COLUMN IF NOT EXISTS "disclaimerAcceptedAt" TIMESTAMP(3);
ALTER TABLE "CaseSession" ADD COLUMN IF NOT EXISTS "disclaimerVersion" TEXT DEFAULT '1.0';
