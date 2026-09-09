import { getSessionUser, unauthorizedJson, forbiddenJson } from "@/lib/api-session";
import { hasUnlimitedCaseAccess } from "@/lib/billing/unlimited-case-access";

export async function requireAdminApi(): Promise<Response | null> {
  const user = await getSessionUser();
  if (!user) return unauthorizedJson();
  if (!hasUnlimitedCaseAccess({ role: user.role, email: user.email })) {
    return forbiddenJson("Forbidden", "FORBIDDEN_ROLE");
  }
  return null;
}
