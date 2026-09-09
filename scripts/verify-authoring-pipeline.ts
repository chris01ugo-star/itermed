/**
 * Integration check for the authoring ingest / generate-cases pipeline.
 *
 * Simulates the API contract (enqueue job → process → poll DTO) without requiring
 * a running Next.js server. Optional live HTTP:
 *   AUTHORING_API_BASE=http://localhost:3000 npx tsx scripts/verify-authoring-pipeline.ts
 *
 * Usage:
 *   npx tsx scripts/verify-authoring-pipeline.ts
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import {
  enqueueGenerateJob,
  enqueueIngestJob,
  getAuthoringJob,
  toAuthoringJobDto,
} from "@/lib/services/authoring-job-service";
import {
  buildDrimePatientProfile,
  generateCases,
} from "@/lib/services/case-generation-service";
import { chunkText, stripNullBytes } from "@/lib/services/ingestion-service";
import { prisma } from "@/lib/prisma";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

async function waitForJob(jobId: string, timeoutMs = 120_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const job = await getAuthoringJob(jobId);
    assert(job, `job ${jobId} disappeared`);
    if (job.status === "COMPLETED" || job.status === "FAILED") return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timeout waiting for job ${jobId}`);
}

async function simulateApiIngest(): Promise<void> {
  const dirty =
    "Linea guida ESC 2023 ACS.\u0000 Protocollo clinico:\nArt. 5 Gelli-Bianco.\n" +
    "Il gold path include ECG e troponina. ".repeat(40);

  const sanitized = stripNullBytes(dirty);
  assert(!sanitized.includes("\0") && !sanitized.includes("\u0000"), "NUL bytes must be stripped");
  assert(!/[\u0001-\u0008]/.test(sanitized), "C0 controls must be stripped");

  const chunks = chunkText(sanitized);
  assert(chunks.length >= 1, "chunkText must produce at least one chunk");
  assert(
    chunks.every((c) => !c.includes("\0")),
    "chunks must not contain NUL",
  );

  const dto = await enqueueIngestJob({
    request: {
      specialty: "cardiologia",
      dryRun: true,
    },
    files: [
      {
        buffer: Buffer.from(dirty, "utf8"),
        filename: "ESC_2023_ACS_Guidelines.md",
        pillar: "CLINICAL",
        title: "ESC ACS (verify)",
      },
    ],
  });

  assert(dto.jobId.length > 0, "ingest API must return jobId");
  assert(dto.status === "PENDING" || dto.status === "PROCESSING", "job starts pending/processing");

  await waitForJob(dto.jobId);

  const polled = await getAuthoringJob(dto.jobId);
  assert(polled, "pollable job");
  const view = toAuthoringJobDto(polled);
  assert(view.status === "COMPLETED", `ingest job should complete, got ${view.status}: ${view.errorMessage}`);
  assert(view.progress === 100, "completed ingest job progress is 100");
  console.log(`[verify] ingest job ${view.jobId} COMPLETED chunks≈`, JSON.stringify(view.result));
}

async function simulateApiGenerate(): Promise<void> {
  const profile = buildDrimePatientProfile({
    caseId: "CARDIO-001",
    condition: "Sindrome coronarica acuta — STEMI anteriore",
    setting: "PRONTO_SOCCORSO",
  });
  assert(profile.healthLiteracy, "D-RIME literacy");
  assert(profile.emotionalState, "D-RIME emotional state");
  assert(profile.communicationStyle.length >= 20, "D-RIME communicationStyle min length");

  const dto = await enqueueGenerateJob({
    request: {
      specialty: "cardiologia",
      count: 1,
      onlyIds: ["CARDIO-001"],
      skipLlm: true,
    },
  });
  assert(dto.jobId.length > 0, "generate API must return jobId");

  await waitForJob(dto.jobId);

  const polled = await getAuthoringJob(dto.jobId);
  assert(polled, "generate job exists");
  const view = toAuthoringJobDto(polled);
  assert(
    view.status === "COMPLETED",
    `generate job should complete, got ${view.status}: ${view.errorMessage}`,
  );

  const stored = await prisma.knowledgeBaseCase.findUnique({ where: { id: "CARDIO-001" } });
  assert(stored, "CARDIO-001 upserted into KnowledgeBaseCase");
  assert(stored.specialty === "cardiologia", "specialty persisted");
  console.log(`[verify] generate job ${view.jobId} COMPLETED upsert CARDIO-001`);
}

async function optionalLiveHttp(): Promise<void> {
  const base = process.env.AUTHORING_API_BASE?.replace(/\/$/, "");
  if (!base) return;

  const ingestRes = await fetch(`${base}/api/admin/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      specialty: "cardiologia",
      ingestFromDisk: true,
      dryRun: true,
    }),
  });
  assert(ingestRes.status === 202 || ingestRes.status === 401 || ingestRes.status === 403, "live ingest status");
  const ingestJson = (await ingestRes.json()) as { jobId?: string; error?: string };
  console.log(`[verify] live HTTP ingest → ${ingestRes.status}`, ingestJson.jobId ?? ingestJson.error);

  const genRes = await fetch(`${base}/api/admin/generate-cases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      specialty: "cardiologia",
      count: 1,
      onlyIds: ["CARDIO-001"],
      skipLlm: true,
    }),
  });
  assert(genRes.status === 202 || genRes.status === 401 || genRes.status === 403, "live generate status");
  const genJson = (await genRes.json()) as { jobId?: string; error?: string };
  console.log(`[verify] live HTTP generate → ${genRes.status}`, genJson.jobId ?? genJson.error);
}

async function main(): Promise<void> {
  console.log("[verify-authoring-pipeline] sanitization + job tracking + Prisma upsert");

  await simulateApiIngest();
  await simulateApiGenerate();

  const direct = await generateCases({
    specialty: "cardiologia",
    count: 1,
    onlyIds: ["CARDIO-001"],
    skipLlm: true,
  });
  assert(direct.upserted.includes("CARDIO-001") || direct.failed.length === 0, "direct generate path");
  console.log("[verify] direct generateCases skipLlm ok");

  await optionalLiveHttp();
  console.log("[verify-authoring-pipeline] OK");
}

main()
  .catch((error) => {
    console.error("[verify-authoring-pipeline] FAILED", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
