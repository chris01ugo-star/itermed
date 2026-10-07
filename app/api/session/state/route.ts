import { prisma } from "../../../../lib/prisma";
import { getSessionUserId, unauthorizedJson } from "../../../../lib/api-session";
import { authorizeOwnedLiveSession } from "../../../../lib/access";
import { toSessionResumeSnapshot } from "@/lib/simulator/session-snapshot";

export const runtime = "nodejs";

const sessionSelect = {
  id: true,
  caseId: true,
  chatHistory: true,
  requestedExamIds: true,
  prescribedMedications: true,
  completedGoldSteps: true,
  elapsedMinutes: true,
  currentTargetCondition: true,
} as const;

export async function GET(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorizedJson();

  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");
  const access = await authorizeOwnedLiveSession({ userId, sessionId });
  if (!access.ok) {
    return new Response(JSON.stringify({ error: access.error, code: access.code }), {
      status: access.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const session = await prisma.caseSession.findUnique({
    where: { id: access.liveSessionId },
    select: sessionSelect,
  });

  if (!session) {
    return new Response(JSON.stringify({ error: "Session not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(toSessionResumeSnapshot(session)), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
