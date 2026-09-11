-- AlterTable
ALTER TABLE "Medication" ADD COLUMN IF NOT EXISTS "aifaBand" TEXT NOT NULL DEFAULT 'A';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Medication_aifaBand_idx" ON "Medication"("aifaBand");
