-- Compact stress history for the final report. Nullable so existing rows stay valid.
ALTER TABLE "CaseSession" ADD COLUMN IF NOT EXISTS "stressTimeline" JSONB;
