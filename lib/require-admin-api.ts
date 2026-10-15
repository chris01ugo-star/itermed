import { getSessionUser, unauthorizedJson, forbiddenJson } from "@/lib/api-session";
import { hasUnlimitedCaseAccess } from "@/lib/billing/unlimited-case-access";
import {
  MUST_CHANGE_PASSWORD_CODE,
  MUST_CHANGE_PASSWORD_MESSAGE,
} from "@/lib/auth/must-change-password";

export async function requireAdminApi(): Promise<Response | null> {
  const user = await getSessionUser();
  if (!user) return unauthorizedJson();
  if (user.mustChangePassword) {
    return forbiddenJson(MUST_CHANGE_PASSWORD_MESSAGE, MUST_CHANGE_PASSWORD_CODE);
  }
  if (!hasUnlimitedCaseAccess({ role: user.role, email: user.email })) {
    return forbiddenJson("Forbidden", "FORBIDDEN_ROLE");
  }
  return null;
}
