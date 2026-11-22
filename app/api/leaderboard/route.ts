import { z } from "zod";
import { getSessionUserId } from "@/lib/api-session";
import {
  fetchLeaderboardPayload,
  updateLeaderboardPreferences,
} from "@/lib/leaderboard/leaderboard-queries";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rateLimited = await enforceRateLimit(req, {
    namespace: "api-leaderboard",
    limit: 30,
    userId,
  });
  if (rateLimited) return rateLimited;

  try {
    const payload = await fetchLeaderboardPayload(userId);
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Failed to load leaderboard" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

const preferencesSchema = z.object({
  leaderboardOptIn: z.boolean().optional(),
  leaderboardNameType: z.enum(["REAL_NAME", "NICKNAME", "ANONYMOUS"]).optional(),
  nickname: z.string().max(40).nullable().optional(),
});

export async function PATCH(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rateLimited = await enforceRateLimit(req, {
    namespace: "api-leaderboard-prefs",
    limit: 20,
    userId,
  });
  if (rateLimited) return rateLimited;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = preferencesSchema.safeParse(raw);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const preferences = await updateLeaderboardPreferences(userId, parsed.data);
  const payload = await fetchLeaderboardPayload(userId);

  return new Response(
    JSON.stringify({
      preferences,
      top50: payload.top50,
      currentUser: payload.currentUser,
      generatedAt: payload.generatedAt,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}
