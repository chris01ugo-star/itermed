import { createLogger } from "@/lib/logger";
import { isUnauthorizedResponse, requireUserApi } from "@/lib/api-session";
import { exportUserData } from "@/lib/account/gdpr-account";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const log = createLogger("account-export");

/**
 * GET /api/account/export — Art. 20 GDPR data portability.
 */
export async function GET(req: Request) {
  const auth = await requireUserApi();
  if (isUnauthorizedResponse(auth)) return auth;
  const { id: userId } = auth;

  const rateLimited = await enforceRateLimit(req, {
    namespace: "api-account-export",
    limit: 5,
    userId,
  });
  if (rateLimited) return rateLimited;

  try {
    const payload = await exportUserData(userId);
    if (!payload) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    log.info("user.data.exported", {
      event: "user.data.exported",
      userId,
      liveSessionCount: payload.liveSessions.length,
      sessionReportCount: payload.sessions.length,
    });

    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="user-data-export.json"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    log.error("Account export failed", { error, userId });
    return new Response(JSON.stringify({ error: "Export failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
