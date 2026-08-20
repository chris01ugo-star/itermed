import { getDevMockUser, isDevAuthBypass } from "./require-user";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth-options";

/**
 * Restituisce l'userId della sessione corrente.
 * In development usa sempre il mock user (creato via upsert su PostgreSQL).
 */
export async function getSessionUserId(): Promise<string | null> {
  if (isDevAuthBypass()) {
    // Never block API routes on Prisma/Neon — mock id is enough for offline play.
    return getDevMockUser().id;
  }

  const session = await getServerSession(authOptions);
  return session?.user?.id?.trim() || null;
}

/**
 * API guard: returns the authenticated user id, or a 401 Response.
 */
export async function requireUserApi(): Promise<{ id: string } | Response> {
  const userId = await getSessionUserId();
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return { id: userId };
}

export function isUnauthorizedResponse(
  value: { id: string } | Response,
): value is Response {
  return value instanceof Response;
}
