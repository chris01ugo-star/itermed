import { getSessionUser, unauthorizedJson, forbiddenJson } from "@/lib/api-session";
import {
  MUST_CHANGE_PASSWORD_CODE,
  MUST_CHANGE_PASSWORD_MESSAGE,
} from "@/lib/auth/must-change-password";

const TEACHER_ROLES = new Set(["INSTRUCTOR", "MEDICO", "ADMIN"]);

/** Any authenticated user (JWT present). Does not grant teacher privileges. */
export async function requireAuthApi(): Promise<Response | null> {
  const user = await getSessionUser();
  if (!user) return unauthorizedJson();
  if (user.mustChangePassword) {
    return forbiddenJson(MUST_CHANGE_PASSWORD_MESSAGE, MUST_CHANGE_PASSWORD_CODE);
  }
  return null;
}

/**
 * Case authoring / AI generation: INSTRUCTOR or ADMIN only.
 * STUDENT receives 403 — authentication alone is not enough.
 */
export async function requireTeacherApi(): Promise<Response | null> {
  const user = await getSessionUser();
  if (!user) return unauthorizedJson();
  if (user.mustChangePassword) {
    return forbiddenJson(MUST_CHANGE_PASSWORD_MESSAGE, MUST_CHANGE_PASSWORD_CODE);
  }
  if (!TEACHER_ROLES.has(user.role)) {
    return forbiddenJson("Forbidden", "FORBIDDEN_ROLE");
  }
  return null;
}

export function isTeacherRole(role: string): boolean {
  return TEACHER_ROLES.has(role);
}
