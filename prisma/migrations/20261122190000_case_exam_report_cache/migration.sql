-- Idempotent shared cache for baseline exam reports (Leva 1).
CREATE TABLE IF NOT EXISTS "CaseExamReportCache" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "contextKey" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "reportJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseExamReportCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CaseExamReportCache_caseId_examId_contextKey_promptVersion_key"
ON "CaseExamReportCache"("caseId", "examId", "contextKey", "promptVersion");

CREATE INDEX IF NOT EXISTS "CaseExamReportCache_caseId_examId_idx"
ON "CaseExamReportCache"("caseId", "examId");
