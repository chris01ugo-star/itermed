import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/api-session";
import { ApplyReferralBodySchema } from "@/lib/billing/schemas";
import { applyReferralCode } from "@/lib/billing/referral";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await enforceRateLimit(request, {
    namespace: "billing-referral-apply",
    limit: 8,
    userId,
  });
  if (limited) return limited;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = ApplyReferralBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Codice invito non valido." }, { status: 400 });
  }

  const result = await applyReferralCode({
    inviteeUserId: userId,
    code: parsed.data.code,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.message, code: result.code }, { status: 400 });
  }
  return NextResponse.json({ ok: true, message: result.message });
}
