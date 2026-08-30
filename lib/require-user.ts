import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth-options";
import { config } from "@/lib/config";
import { getBetaEmailAllowlistFromEnv, isBetaAuthorized } from "@/lib/beta/access";
import { prisma } from "@/lib/prisma";
import { isRuntimeDevelopment } from "@/lib/security/dev-only-gates";

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
  // Hard stop: never mock-admin outside `next dev`, even if config/env is mis-set.
  if (!isRuntimeDevelopment()) return false;
  return config.DEV_AUTH_BYPASS;
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

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id },
      select: { role: true, planType: true, email: true },
    });
    if (
      !dbUser ||
      !isBetaAuthorized({
        role: dbUser.role,
        planType: dbUser.planType,
        email: dbUser.email,
        allowlist: getBetaEmailAllowlistFromEnv(),
      })
    ) {
      redirect("/?beta=pending#lista-attesa");
    }
  } catch (err) {
    // `redirect()` throws a special Next.js error — rethrow it.
    if (
      err &&
      typeof err === "object" &&
      "digest" in err &&
      typeof (err as { digest?: unknown }).digest === "string" &&
      String((err as { digest: string }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw err;
    }
    // Transient DB errors: fall through with session (middleware already gated).
  }

  return {
    id,
    email: session.user.email ?? null,
    name: session.user.name ?? null,
    role: session.user.role ?? "STUDENT",
  };
}
