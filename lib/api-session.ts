import { getDevMockUser, isDevAuthBypass } from "./require-user";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth-options";

export const AUTH_JSON_HEADERS = { "Content-Type": "application/json" } as const;

export function unauthorizedJson(message = "Unauthorized"): Response {
  return new Response(JSON.stringify({ error: message, code: "UNAUTHORIZED" }), {
    status: 401,
    headers: AUTH_JSON_HEADERS,
  });
}

export function forbiddenJson(message = "Forbidden", code = "FORBIDDEN"): Response {
  return new Response(JSON.stringify({ error: message, code }), {
    status: 403,
    headers: AUTH_JSON_HEADERS,
  });
}

export type ApiSessionUser = {
  id: string;
  role: string;
};

/**
 * Restituisce l'userId della sessione corrente.
 * Mock admin only when NODE_ENV === "development" AND DEV_AUTH_BYPASS is enabled.
 */
export async function getSessionUserId(): Promise<string | null> {
  const user = await getSessionUser();
  return user?.id ?? null;
}

export async function getSessionUser(): Promise<ApiSessionUser | null> {
  if (isDevAuthBypass()) {
    const mock = getDevMockUser();
    return { id: mock.id, role: mock.role };
  }

  const session = await getServerSession(authOptions);
  const id = session?.user?.id?.trim();
  if (!session?.user || !id) return null;
  return { id, role: session.user.role?.trim() || "STUDENT" };
}

/**
 * API guard: JWT/session first. No caller should hit Prisma or LLMs before this.
 */
export async function requireUserApi(): Promise<ApiSessionUser | Response> {
  const user = await getSessionUser();
  if (!user) return unauthorizedJson();
  return user;
}

export function isUnauthorizedResponse(
  value: { id: string } | Response,
): value is Response {
  return value instanceof Response;
}
