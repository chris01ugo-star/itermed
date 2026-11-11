import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

export type EdgeSessionUser = {
  id: string;
  role: string;
  email?: string | null;
};

const TEACHER_ROLES = new Set(["INSTRUCTOR", "MEDICO", "ADMIN"]);

const AUTH_JSON_HEADERS = { "Content-Type": "application/json" } as const;

function unauthorizedJson(message = "Unauthorized"): Response {
  return new Response(JSON.stringify({ error: message, code: "UNAUTHORIZED" }), {
    status: 401,
    headers: AUTH_JSON_HEADERS,
  });
}

function forbiddenJson(message = "Forbidden", code = "FORBIDDEN"): Response {
  return new Response(JSON.stringify({ error: message, code }), {
    status: 403,
    headers: AUTH_JSON_HEADERS,
  });
}

function isDevAuthBypass(): boolean {
  if (process.env.NODE_ENV !== "development") return false;
  return process.env.DEV_AUTH_BYPASS !== "false";
}

/**
 * JWT session for Edge Route Handlers. Does not import Prisma, bcrypt, or `authOptions`.
 */
export async function getEdgeSessionUser(req: NextRequest): Promise<EdgeSessionUser | null> {
  if (isDevAuthBypass()) {
    return {
      id: "mock-dev-user-id",
      role: "ADMIN",
      email: "test@itermed.com",
    };
  }

  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret) return null;

  const token = await getToken({ req, secret });
  const id =
    typeof token?.id === "string" && token.id.trim()
      ? token.id.trim()
      : typeof token?.sub === "string" && token.sub.trim()
        ? token.sub.trim()
        : null;
  if (!token || !id) return null;

  return {
    id,
    role: typeof token.role === "string" && token.role.trim() ? token.role.trim() : "STUDENT",
    email: typeof token.email === "string" ? token.email : null,
  };
}

export async function requireTeacherApiEdge(req: NextRequest): Promise<Response | null> {
  const user = await getEdgeSessionUser(req);
  if (!user) return unauthorizedJson();
  if (!TEACHER_ROLES.has(user.role)) {
    return forbiddenJson("Forbidden", "FORBIDDEN_ROLE");
  }
  return null;
}
