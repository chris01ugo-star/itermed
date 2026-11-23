import { prisma } from "../../../../lib/prisma";
import { userCanPlayCase } from "../../../../lib/access";
import { getSessionUserId } from "../../../../lib/api-session";
import { AI_RATE_LIMITS } from "@/lib/security/ai-rate-limits";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { extractPatientPromptFromNode } from "@/lib/cases/case-payload";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: caseId } = await context.params;

  const userId = await getSessionUserId();
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rateLimited = await enforceRateLimit(req, {
    namespace: "api-cases-read",
    limit: AI_RATE_LIMITS.casesRead,
    userId,
  });
  if (rateLimited) return rateLimited;

  const allowed = await userCanPlayCase(userId, caseId);
  if (!allowed) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const clinicalCase = await prisma.clinicalCase.findUnique({
    where: { id: caseId },
    include: {
      nodes: { orderBy: { order: "asc" }, take: 1 },
    },
  });

  if (!clinicalCase) {
    return new Response(JSON.stringify({ error: "Case not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const firstNode = clinicalCase.nodes[0];
  const casePrompt = extractPatientPromptFromNode(
    firstNode?.content,
    `${clinicalCase.title}. ${clinicalCase.description}`,
  );

  return new Response(
    JSON.stringify({
      id: clinicalCase.id,
      title: clinicalCase.title,
      description: clinicalCase.description,
      specialty: clinicalCase.specialty,
      difficulty: clinicalCase.difficulty,
      estimatedDurationMinutes: clinicalCase.estimatedDurationMinutes,
      casePrompt,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

