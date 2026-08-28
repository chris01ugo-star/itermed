-- CreateEnum
CREATE TYPE "IngestionJobKind" AS ENUM ('INGEST', 'GENERATE');

-- CreateEnum
CREATE TYPE "IngestionJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "IngestionJob" (
    "id" TEXT NOT NULL,
    "kind" "IngestionJobKind" NOT NULL,
    "specialty" TEXT NOT NULL,
    "status" "IngestionJobStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "progressMessage" TEXT NOT NULL DEFAULT 'In coda...',
    "errorMessage" TEXT,
    "result" JSONB,
    "payload" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngestionJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IngestionJob_status_idx" ON "IngestionJob"("status");

-- CreateIndex
CREATE INDEX "IngestionJob_specialty_kind_idx" ON "IngestionJob"("specialty", "kind");
