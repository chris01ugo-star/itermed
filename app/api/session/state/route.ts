import { prisma } from "../../../../lib/prisma";
import { getSessionUserId, unauthorizedJson } from "../../../../lib/api-session";
import { authorizeOwnedLiveSession } from "../../../../lib/access";

export const runtime = "nodejs";

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
    select: { id: true },
  });

  if (!session) {
    return new Response(JSON.stringify({ error: "Session not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      sessionId: session.id,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

