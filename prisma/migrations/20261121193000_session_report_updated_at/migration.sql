-- Staleness clock for simulation-report worker reclaim.
ALTER TABLE "SessionReport" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
