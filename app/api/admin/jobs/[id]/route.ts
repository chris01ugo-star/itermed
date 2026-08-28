import { requireAdminApi } from "@/lib/require-admin-api";
import { getAuthoringJob, toAuthoringJobDto } from "@/lib/services/authoring-job-service";

export const runtime = "nodejs";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const { id } = await context.params;
  const job = await getAuthoringJob(id);
  if (!job) {
    return jsonResponse({ error: "Job non trovato." }, 404);
  }
  return jsonResponse(toAuthoringJobDto(job));
}
