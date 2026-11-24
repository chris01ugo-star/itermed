import "server-only";
import type Stripe from "stripe";
import { getStripeClient, isStripeConfigured } from "@/lib/billing/stripe-client";
import {
  handleCheckoutSessionCompleted,
  handleInvoicePaid,
} from "@/lib/billing/webhook-handlers";
import { createLogger } from "@/lib/logger";

const log = createLogger("billing-reconcile");

function sessionBelongsToUser(session: Stripe.Checkout.Session, userId: string): boolean {
  return session.client_reference_id === userId || session.metadata?.userId === userId;
}

function invoiceIdOf(session: Stripe.Checkout.Session, subscription?: Stripe.Subscription | null): string | null {
  if (typeof session.invoice === "string") return session.invoice;
  if (session.invoice && typeof session.invoice === "object" && "id" in session.invoice) {
    return session.invoice.id ?? null;
  }
  const latest = subscription?.latest_invoice;
  if (typeof latest === "string") return latest;
  if (latest && typeof latest === "object" && "id" in latest) return latest.id ?? null;
  return null;
}

/**
 * If the webhook is slow or missing, apply the paid Checkout session when the
 * user returns to /dashboard/billing?billing=success&session_id=...
 * Handlers stay idempotent via StripeProcessedEvent / credit txn keys.
 */
export async function reconcilePaidCheckoutSession(
  userId: string,
  sessionId: string | undefined,
): Promise<void> {
  const id = sessionId?.trim();
  if (!id || !id.startsWith("cs_") || !isStripeConfigured()) return;

  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(id, {
      expand: ["subscription", "invoice"],
    });
    if (!sessionBelongsToUser(session, userId)) return;
    if (session.status !== "complete" && session.payment_status !== "paid") return;

    await handleCheckoutSessionCompleted(session);

    if (session.mode !== "subscription") return;

    const subscription =
      typeof session.subscription === "object" && session.subscription && "id" in session.subscription
        ? (session.subscription as Stripe.Subscription)
        : session.subscription
          ? await stripe.subscriptions.retrieve(String(session.subscription))
          : null;
    const invoiceId = invoiceIdOf(session, subscription);
    if (!invoiceId) return;
    const invoice = await stripe.invoices.retrieve(invoiceId);
    if (invoice.status === "paid") {
      await handleInvoicePaid(invoice);
    }
  } catch (error) {
    log.warn("Could not reconcile checkout session on return URL", { userId, sessionId: id, error });
  }
}
