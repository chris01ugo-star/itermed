import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth-options";
import { config } from "@/lib/config";

export type SessionUser = {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
};

const DEV_MOCK_USER: SessionUser = {
  id: "mock-dev-user-id",
  email: "test@itermed.com",
  name: "Dev User",
  role: "ADMIN",
};

/** Canonical sandbox tester id — analytics merge legacy guest ids with this account. */
export const SANDBOX_TEST_USER_ID = "cl-tester-999";

export function isDevAuthBypass(): boolean {
  return config.isDevelopment && config.DEV_AUTH_BYPASS;
}

export function getDevMockUser(): SessionUser {
  return DEV_MOCK_USER;
}

export async function requireAdmin(): Promise<SessionUser> {
  if (isDevAuthBypass()) {
    return getDevMockUser();
  }

  const session = await getServerSession(authOptions);
  const id = session?.user?.id;
  if (!id) redirect("/login?callbackUrl=/dashboard/guidelines");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return {
    id,
    email: session.user.email ?? null,
    name: session.user.name ?? null,
    role: session.user.role ?? "STUDENT",
  };
}

export async function requireUser(): Promise<SessionUser> {
  if (isDevAuthBypass()) {
    return getDevMockUser();
  }

  const session = await getServerSession(authOptions);
  const id = session?.user?.id;
  if (!id) redirect("/login");
  return {
    id,
    email: session.user.email ?? null,
    name: session.user.name ?? null,
    role: session.user.role ?? "STUDENT",
  };
}
