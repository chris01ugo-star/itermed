import { after } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth-options";
import { createLogger } from "@/lib/logger";
import { requireAdminApi } from "@/lib/require-admin-api";
import {
  enqueueGenerateJob,
  getAuthoringJob,
  scheduleAuthoringJob,
  toAuthoringJobDto,
} from "@/lib/services/authoring-job-service";

export const runtime = "nodejs";
export const maxDuration = 60;

const generateLogger = createLogger("admin-generate-cases-api");

const GenerateBodySchema = z.object({
  specialty: z.enum(["cardiologia", "pneumologia", "gastroenterologia"]),
  count: z.coerce.number().int().min(1).max(30).optional().default(30),
  frequencyCategory: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  difficulty: z.enum(["BASE", "INTERMEDIATE", "ADVANCED"]).optional(),
  setting: z.enum(["GUARDIA_MEDICA", "PRONTO_SOCCORSO", "AMBULATORIO", "REPARTO"]).optional(),
  onlyIds: z.array(z.string().min(1).max(40)).max(30).optional(),
  skipLlm: z.boolean().optional(),
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
  if (!job || job.kind !== "GENERATE") {
    return jsonResponse({ error: "Job di generazione non trovato." }, 404);
  }
  return jsonResponse(toAuthoringJobDto(job));
}

export async function POST(req: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  try {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return jsonResponse({ error: "JSON non valido." }, 400);
    }

    const parsed = GenerateBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonResponse({ error: parsed.error.flatten() }, 400);
    }

    const dto = await enqueueGenerateJob({
      createdById: await actorId(),
      request: parsed.data,
    });

    after(async () => {
      scheduleAuthoringJob(dto.jobId);
    });

    return jsonResponse(dto, 202);
  } catch (error) {
    generateLogger.error("Generate-cases enqueue failed", { error });
    const message = error instanceof Error ? error.message : "Errore generazione casi.";
    return jsonResponse({ error: message }, 500);
  }
}
