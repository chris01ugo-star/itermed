/**
 * In-process authoring job queue (ingest + case generation).
 * Mirrors the simulation-report scheduler: Prisma row for polling + `after()` worker.
 */
import { Prisma, type IngestionJob, type IngestionJobKind, type IngestionJobStatus } from "@prisma/client";
import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  generateCases,
  isKbSpecialty,
  type GenerateCasesInput,
  type KbSpecialty,
} from "@/lib/services/case-generation-service";
import {
  ingestDocumentFromBuffer,
  ingestDocumentFromUrl,
  ingestSpecialtyFromDisk,
  resolvePillar,
  type IngestPillar,
  type IngestRunResult,
} from "@/lib/services/ingestion-service";

const logger = createLogger("authoring-job-service");

export type AuthoringJobDto = {
  jobId: string;
  kind: IngestionJobKind;
  specialty: string;
  status: IngestionJobStatus;
  progress: number;
  progressMessage: string;
  errorMessage: string | null;
  result: unknown;
  createdAt: string;
  updatedAt: string;
};

export type IngestJobRequest = {
  specialty: string;
  update?: boolean;
  ingestFromDisk?: boolean;
  sourceUrl?: string;
  pillar?: IngestPillar | string;
  filename?: string;
  title?: string;
  dryRun?: boolean;
};

export type GenerateJobRequest = {
  specialty: KbSpecialty;
  count?: number;
  frequencyCategory?: GenerateCasesInput["frequencyCategory"];
  difficulty?: GenerateCasesInput["difficulty"];
  setting?: GenerateCasesInput["setting"];
  onlyIds?: string[];
  skipLlm?: boolean;
};

export type IngestRuntimeFile = {
  buffer: Buffer;
  filename: string;
  pillar?: IngestPillar;
  title?: string;
};

type RuntimeSlot = {
  files?: IngestRuntimeFile[];
};

const globalForAuthoring = globalThis as unknown as {
  authoringJobs?: Map<string, Promise<void>>;
  authoringRuntime?: Map<string, RuntimeSlot>;
};

const activeJobs = globalForAuthoring.authoringJobs ?? new Map<string, Promise<void>>();
const runtimePayloads = globalForAuthoring.authoringRuntime ?? new Map<string, RuntimeSlot>();
globalForAuthoring.authoringJobs = activeJobs;
globalForAuthoring.authoringRuntime = runtimePayloads;

export function toAuthoringJobDto(job: IngestionJob): AuthoringJobDto {
  return {
    jobId: job.id,
    kind: job.kind,
    specialty: job.specialty,
    status: job.status,
    progress: job.progress,
    progressMessage: job.progressMessage,
    errorMessage: job.errorMessage,
    result: job.result,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

export async function createAuthoringJob(params: {
  kind: IngestionJobKind;
  specialty: string;
  payload: Record<string, unknown>;
  createdById?: string | null;
  files?: IngestRuntimeFile[];
}): Promise<IngestionJob> {
  const job = await prisma.ingestionJob.create({
    data: {
      kind: params.kind,
      specialty: params.specialty,
      status: "PENDING",
      progress: 0,
      progressMessage: "In coda...",
      payload: params.payload as Prisma.InputJsonValue,
      createdById: params.createdById ?? undefined,
    },
  });
  if (params.files?.length) {
    runtimePayloads.set(job.id, { files: params.files });
  }
  return job;
}

export async function getAuthoringJob(jobId: string): Promise<IngestionJob | null> {
  await failStaleAuthoringJobs();
  return prisma.ingestionJob.findUnique({ where: { id: jobId } });
}

/** Jobs left in PROCESSING longer than this are treated as killed serverless workers. */
export const STALE_JOB_TIMEOUT_MS = 15 * 60 * 1000;

/** Hard timeout for a live worker so the row is FAILED before the stale window. */
export const AUTHORING_JOB_HARD_TIMEOUT_MS = 14 * 60 * 1000;

const STALE_JOB_ERROR =
  "Job interrotto: rimasto in PROCESSING oltre 15 minuti (timeout serverless / worker terminato).";

export async function failStaleAuthoringJobs(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - STALE_JOB_TIMEOUT_MS);
  try {
    const result = await prisma.ingestionJob.updateMany({
      where: {
        status: "PROCESSING",
        updatedAt: { lt: cutoff },
      },
      data: {
        status: "FAILED",
        progressMessage: "Fallito",
        errorMessage: STALE_JOB_ERROR,
      },
    });
    if (result.count > 0) {
      logger.warn("Marked stale PROCESSING jobs as FAILED", { count: result.count });
    }
    return result.count;
  } catch (error) {
    logger.error("failStaleAuthoringJobs failed", { error });
    return 0;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label}: timeout dopo ${Math.round(ms / 1000)}s`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function setJobProgress(jobId: string, progress: number, message: string): Promise<void> {
  try {
    await prisma.ingestionJob.updateMany({
      where: { id: jobId, status: { in: ["PENDING", "PROCESSING"] } },
      data: {
        status: "PROCESSING",
        progress: Math.max(0, Math.min(100, Math.round(progress))),
        progressMessage: message.slice(0, 500),
      },
    });
  } catch (error) {
    logger.warn("setJobProgress failed", { jobId, error });
  }
}

async function completeJob(jobId: string, result: unknown): Promise<void> {
  await prisma.ingestionJob.updateMany({
    where: { id: jobId, status: { in: ["PENDING", "PROCESSING"] } },
    data: {
      status: "COMPLETED",
      progress: 100,
      progressMessage: "Completato",
      errorMessage: null,
      result: result as Prisma.InputJsonValue,
    },
  });
}

async function failJob(jobId: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  try {
    await prisma.ingestionJob.updateMany({
      where: { id: jobId, status: { in: ["PENDING", "PROCESSING"] } },
      data: {
        status: "FAILED",
        progressMessage: "Fallito",
        errorMessage: message.slice(0, 2000),
      },
    });
  } catch (failError) {
    logger.error("failJob could not persist FAILED status", { jobId, failError });
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function runIngestJob(job: IngestionJob): Promise<unknown> {
  const payload = asRecord(job.payload);
  const specialty = String(payload.specialty ?? job.specialty);
  const update = payload.update === true;
  const dryRun = payload.dryRun === true;
  const onProgress = (progress: number, message: string) => setJobProgress(job.id, progress, message);

  const runtime = runtimePayloads.get(job.id);

  if (runtime?.files?.length) {
    const documents = [];
    for (let i = 0; i < runtime.files.length; i += 1) {
      const file = runtime.files[i];
      await onProgress(
        Math.min(95, Math.round(((i + 1) / runtime.files.length) * 90) + 5),
        `Ingestione ${file.filename}`,
      );
      documents.push(
        await ingestDocumentFromBuffer({
          specialty,
          buffer: file.buffer,
          filename: file.filename,
          pillar: file.pillar,
          title: file.title,
          update,
          dryRun,
        }),
      );
    }
    return {
      documents: documents.length,
      chunks: documents.reduce((acc, d) => acc + d.chunks, 0),
      files: documents,
    };
  }

  if (typeof payload.sourceUrl === "string" && payload.sourceUrl.trim()) {
    await onProgress(15, "Download documento remoto");
    const result = await ingestDocumentFromUrl({
      specialty,
      sourceUrl: payload.sourceUrl.trim(),
      pillar: typeof payload.pillar === "string" ? resolvePillar(payload.pillar) : undefined,
      filename: typeof payload.filename === "string" ? payload.filename : undefined,
      title: typeof payload.title === "string" ? payload.title : undefined,
      update,
      dryRun,
    });
    return result;
  }

  if (payload.ingestFromDisk === true) {
    const result: IngestRunResult = await ingestSpecialtyFromDisk({
      specialty,
      update,
      dryRun,
      onProgress,
    });
    return result;
  }

  throw new Error(
    "Payload ingest incompleto: fornire un file, un URL, o ingestFromDisk=true.",
  );
}

async function runGenerateJob(job: IngestionJob): Promise<unknown> {
  const payload = asRecord(job.payload);
  const specialtyRaw = String(payload.specialty ?? job.specialty).toLowerCase();
  if (!isKbSpecialty(specialtyRaw)) {
    throw new Error(`Specialità non supportata per la generazione: ${specialtyRaw}`);
  }

  return generateCases({
    specialty: specialtyRaw,
    count: typeof payload.count === "number" ? payload.count : undefined,
    frequencyCategory:
      payload.frequencyCategory === "HIGH" ||
      payload.frequencyCategory === "MEDIUM" ||
      payload.frequencyCategory === "LOW"
        ? payload.frequencyCategory
        : undefined,
    difficulty:
      payload.difficulty === "BASE" ||
      payload.difficulty === "INTERMEDIATE" ||
      payload.difficulty === "ADVANCED"
        ? payload.difficulty
        : undefined,
    setting:
      payload.setting === "GUARDIA_MEDICA" ||
      payload.setting === "PRONTO_SOCCORSO" ||
      payload.setting === "AMBULATORIO" ||
      payload.setting === "REPARTO"
        ? payload.setting
        : undefined,
    onlyIds: Array.isArray(payload.onlyIds)
      ? payload.onlyIds.filter((id): id is string => typeof id === "string")
      : undefined,
    skipLlm: payload.skipLlm === true,
    onProgress: (progress, message) => setJobProgress(job.id, progress, message),
  });
}

export async function processAuthoringJob(jobId: string): Promise<void> {
  let settled = false;
  try {
    await failStaleAuthoringJobs();

    const job = await prisma.ingestionJob.findUnique({ where: { id: jobId } });
    if (!job) {
      logger.warn("Authoring job not found", { jobId });
      settled = true;
      return;
    }

    if (job.status === "COMPLETED" || job.status === "FAILED") {
      settled = true;
      return;
    }

    if (job.status === "PROCESSING") {
      const ageMs = Date.now() - job.updatedAt.getTime();
      if (ageMs < STALE_JOB_TIMEOUT_MS) {
        logger.info("Authoring job already processing — skip duplicate worker", { jobId, ageMs });
        settled = true;
        return;
      }
    }

    const claimed = await prisma.ingestionJob.updateMany({
      where: { id: jobId, status: { in: ["PENDING", "PROCESSING"] } },
      data: { status: "PROCESSING", progress: 5, progressMessage: "Avvio elaborazione..." },
    });
    if (claimed.count === 0) {
      settled = true;
      return;
    }

    const work =
      job.kind === "INGEST" ? runIngestJob(job) : runGenerateJob(job);
    const result = await withTimeout(work, AUTHORING_JOB_HARD_TIMEOUT_MS, `Authoring job ${jobId}`);
    await completeJob(jobId, result);
    settled = true;
    logger.info("Authoring job completed", { jobId, kind: job.kind, specialty: job.specialty });
  } catch (error) {
    logger.error("Authoring job failed", { jobId, error });
    await failJob(jobId, error);
    settled = true;
  } finally {
    runtimePayloads.delete(jobId);
    if (!settled) {
      await failJob(
        jobId,
        new Error("Job terminato senza complete/fail esplicito (unhandled exception o kill serverless)."),
      );
    }
  }
}

export function scheduleAuthoringJob(jobId: string): void {
  if (activeJobs.has(jobId)) {
    logger.info("Authoring job already running — skip duplicate schedule", { jobId });
    return;
  }

  const job = processAuthoringJob(jobId)
    .catch(async (error) => {
      logger.error("Unhandled authoring job rejection", { jobId, error });
      await failJob(jobId, error);
    })
    .finally(() => {
      activeJobs.delete(jobId);
    });

  activeJobs.set(jobId, job);
}

export async function enqueueIngestJob(params: {
  request: IngestJobRequest;
  files?: IngestRuntimeFile[];
  createdById?: string | null;
}): Promise<AuthoringJobDto> {
  await failStaleAuthoringJobs();
  const specialty = params.request.specialty.trim().toLowerCase();
  if (!specialty) throw new Error("specialty è obbligatorio.");

  const payload: Record<string, unknown> = {
    specialty,
    update: Boolean(params.request.update),
    ingestFromDisk: Boolean(params.request.ingestFromDisk),
    dryRun: Boolean(params.request.dryRun),
  };
  if (params.request.sourceUrl) payload.sourceUrl = params.request.sourceUrl;
  if (params.request.pillar) payload.pillar = resolvePillar(String(params.request.pillar));
  if (params.request.filename) payload.filename = params.request.filename;
  if (params.request.title) payload.title = params.request.title;

  const job = await createAuthoringJob({
    kind: "INGEST",
    specialty,
    payload,
    createdById: params.createdById,
    files: params.files,
  });
  scheduleAuthoringJob(job.id);
  return toAuthoringJobDto(job);
}

export async function enqueueGenerateJob(params: {
  request: GenerateJobRequest;
  createdById?: string | null;
}): Promise<AuthoringJobDto> {
  await failStaleAuthoringJobs();
  const specialty = params.request.specialty;
  const payload: Record<string, unknown> = {
    specialty,
    count: params.request.count ?? 30,
    skipLlm: Boolean(params.request.skipLlm),
  };
  if (params.request.frequencyCategory) payload.frequencyCategory = params.request.frequencyCategory;
  if (params.request.difficulty) payload.difficulty = params.request.difficulty;
  if (params.request.setting) payload.setting = params.request.setting;
  if (params.request.onlyIds?.length) payload.onlyIds = params.request.onlyIds;

  const job = await createAuthoringJob({
    kind: "GENERATE",
    specialty,
    payload,
    createdById: params.createdById,
  });
  scheduleAuthoringJob(job.id);
  return toAuthoringJobDto(job);
}
