import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/api-session";
import { config } from "@/lib/config";
import { getOrCreateStripeCustomer, getUserBillingProfile } from "@/lib/billing/user-billing";
import { getStripeClient, isStripeConfigured } from "@/lib/billing/stripe-client";

export const runtime = "nodejs";

export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe billing is not configured" }, { status: 503 });
  }

  const profile = await getUserBillingProfile(userId);
  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (!profile.stripeCustomerId) {
    return NextResponse.json(
      { error: "Nessun cliente di pagamento associato. Sottoscrivi un piano prima." },
      { status: 400 },
    );
  }

  const customerId = await getOrCreateStripeCustomer(profile);
  const stripe = getStripeClient();
  const origin = config.APP_URL.replace(/\/$/, "");
  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/dashboard/billing`,
  });
  if (!portal.url) {
    return NextResponse.json({ error: "Failed to create portal session" }, { status: 500 });
  }
  return NextResponse.json({ url: portal.url });
}
