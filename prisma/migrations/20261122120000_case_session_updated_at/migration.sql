-- Staleness clock for abandoned CaseSession cleanup.
-- DEFAULT CURRENT_TIMESTAMP backfills existing rows so the ADD COLUMN does not fail.
ALTER TABLE "CaseSession" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
