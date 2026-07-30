import { cookies } from "next/headers";
import { createLogger } from "@/lib/logger";
import { isUnauthorizedResponse, requireUserApi } from "@/lib/api-session";
import {
  eraseUserAccount,
  NEXTAUTH_COOKIE_NAMES,
} from "@/lib/account/gdpr-account";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const log = createLogger("account-delete");

/**
 * DELETE /api/account/delete — Art. 17 GDPR right to erasure.
 */
export async function DELETE(req: Request) {
  const auth = await requireUserApi();
  if (isUnauthorizedResponse(auth)) return auth;
  const { id: userId } = auth;

  const rateLimited = await enforceRateLimit(req, {
    namespace: "api-account-delete",
    limit: 3,
    userId,
  });
  if (rateLimited) return rateLimited;

  try {
    await eraseUserAccount(userId);
  } catch (error) {
    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    log.error("Account erasure failed", { error, userId });
    return new Response(JSON.stringify({ error: "Account deletion failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Invalidate NextAuth JWT session cookies (strategy: jwt — no DB session row).
  try {
    const cookieStore = await cookies();
    for (const name of NEXTAUTH_COOKIE_NAMES) {
      cookieStore.delete(name);
    }
  } catch (error) {
    log.warn("Failed to clear NextAuth cookies after erasure", { error, userId });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      message: "Account e dati personali eliminati.",
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
}
