import { getSessionUser, unauthorizedJson, forbiddenJson } from "@/lib/api-session";

export async function requireAdminApi(): Promise<Response | null> {
  const user = await getSessionUser();
  if (!user) return unauthorizedJson();
  if (user.role !== "ADMIN") {
    return forbiddenJson("Forbidden", "FORBIDDEN_ROLE");
  }
  return null;
}
