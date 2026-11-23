-- Banco LIS v2. Nullable: le sessioni cliniche e i casi laboratorio v1 restano invariati.
ALTER TABLE "CaseSession" ADD COLUMN IF NOT EXISTS "labWorkbenchState" JSONB;
