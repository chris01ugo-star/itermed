import { getSessionUser, unauthorizedJson, forbiddenJson } from "@/lib/api-session";

const TEACHER_ROLES = new Set(["INSTRUCTOR", "ADMIN"]);

/** Any authenticated user (JWT present). Does not grant teacher privileges. */
export async function requireAuthApi(): Promise<Response | null> {
  const user = await getSessionUser();
  if (!user) return unauthorizedJson();
  return null;
}

/**
 * Case authoring / AI generation: INSTRUCTOR or ADMIN only.
 * STUDENT receives 403 — authentication alone is not enough.
 */
export async function requireTeacherApi(): Promise<Response | null> {
  const user = await getSessionUser();
  if (!user) return unauthorizedJson();
  if (!TEACHER_ROLES.has(user.role)) {
    return forbiddenJson("Forbidden", "FORBIDDEN_ROLE");
  }
  return null;
}

export function isTeacherRole(role: string): boolean {
  return TEACHER_ROLES.has(role);
}
