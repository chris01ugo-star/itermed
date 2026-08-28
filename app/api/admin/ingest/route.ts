import { after } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth-options";
import { createLogger } from "@/lib/logger";
import { requireAdminApi } from "@/lib/require-admin-api";
import {
  enqueueIngestJob,
  getAuthoringJob,
  scheduleAuthoringJob,
  toAuthoringJobDto,
  type IngestRuntimeFile,
} from "@/lib/services/authoring-job-service";
import { resolvePillar, type IngestPillar } from "@/lib/services/ingestion-service";

export const runtime = "nodejs";
export const maxDuration = 60;

const ingestLogger = createLogger("admin-ingest-api");

const JsonBodySchema = z.object({
  specialty: z.string().min(1),
  sourceUrl: z.string().url().optional(),
  pillar: z.enum(["LEGAL", "ECONOMIC", "CLINICAL"]).optional(),
  update: z.boolean().optional(),
  ingestFromDisk: z.boolean().optional(),
  title: z.string().min(1).max(240).optional(),
  filename: z.string().min(1).max(240).optional(),
  dryRun: z.boolean().optional(),
});

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function actorId(): Promise<string | null> {
  try {
    const session = await getServerSession(authOptions);
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const jobId = new URL(req.url).searchParams.get("jobId")?.trim();
  if (!jobId) {
    return jsonResponse({ error: "jobId è obbligatorio per il polling." }, 400);
  }

  const job = await getAuthoringJob(jobId);
  if (!job || job.kind !== "INGEST") {
    return jsonResponse({ error: "Job di ingestione non trovato." }, 404);
  }
  return jsonResponse(toAuthoringJobDto(job));
}

export async function POST(req: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  try {
    const contentType = req.headers.get("content-type") ?? "";
    const createdById = await actorId();

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const specialty = String(form.get("specialty") ?? "").trim();
      if (!specialty) {
        return jsonResponse({ error: "specialty è obbligatorio." }, 400);
      }

      const update = String(form.get("update") ?? "") === "true";
      const ingestFromDisk = String(form.get("ingestFromDisk") ?? "") === "true";
      const dryRun = String(form.get("dryRun") ?? "") === "true";
      const sourceUrl = String(form.get("sourceUrl") ?? "").trim() || undefined;
      const title = String(form.get("title") ?? "").trim() || undefined;
      const pillarRaw = String(form.get("pillar") ?? "").trim();
      let pillar: IngestPillar | undefined;
      if (pillarRaw) pillar = resolvePillar(pillarRaw);

      const files: IngestRuntimeFile[] = [];
      const uploaded = form.getAll("file").concat(form.getAll("files"));
      for (const entry of uploaded) {
        if (!(entry instanceof File)) continue;
        const buffer = Buffer.from(await entry.arrayBuffer());
        files.push({
          buffer,
          filename: entry.name || "upload.bin",
          pillar,
          title,
        });
      }

      if (!files.length && !sourceUrl && !ingestFromDisk) {
        return jsonResponse(
          { error: "Fornire un file PDF, un sourceUrl, oppure ingestFromDisk=true." },
          400,
        );
      }

      const dto = await enqueueIngestJob({
        createdById,
        files: files.length ? files : undefined,
        request: { specialty, update, ingestFromDisk, sourceUrl, pillar, title, dryRun },
      });

      after(async () => {
        scheduleAuthoringJob(dto.jobId);
      });

      return jsonResponse(dto, 202);
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return jsonResponse({ error: "JSON non valido." }, 400);
    }

    const parsed = JsonBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonResponse({ error: parsed.error.flatten() }, 400);
    }

    if (!parsed.data.sourceUrl && !parsed.data.ingestFromDisk) {
      return jsonResponse(
        { error: "Fornire sourceUrl oppure ingestFromDisk=true (oppure multipart con file)." },
        400,
      );
    }

    const dto = await enqueueIngestJob({
      createdById,
      request: parsed.data,
    });

    after(async () => {
      scheduleAuthoringJob(dto.jobId);
    });

    return jsonResponse(dto, 202);
  } catch (error) {
    ingestLogger.error("Ingest enqueue failed", { error });
    const message = error instanceof Error ? error.message : "Errore ingestione.";
    return jsonResponse({ error: message }, 500);
  }
}
