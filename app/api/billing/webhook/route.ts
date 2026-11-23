import { NextResponse } from "next/server";
import Stripe from "stripe";
import { config } from "@/lib/config";
import { getStripeClient } from "@/lib/billing/stripe-client";
import {
  handleChargeRefunded,
  handleCheckoutSessionCompleted,
  handleDisputeCreated,
  handleEarlyFraudWarning,
  handleInvoicePaid,
  handleInvoicePaymentFailed,
  handleSubscriptionDeleted,
  handleSubscriptionUpdated,
  withStripeEvent,
} from "@/lib/billing/webhook-handlers";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";

const log = createLogger("stripe-webhook");

export async function POST(request: Request) {
  if (!config.STRIPE_SECRET_KEY || !config.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe webhook not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;

  try {
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(rawBody, signature, config.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    log.warn("Webhook signature verification failed", { error });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const result = await withStripeEvent(event, async () => {
      switch (event.type) {
        case "checkout.session.completed":
        case "checkout.session.async_payment_succeeded":
          await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
          break;
        case "invoice.paid":
          await handleInvoicePaid(event.data.object as Stripe.Invoice);
          break;
        case "invoice.payment_failed":
          await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;
        case "customer.subscription.created":
        case "customer.subscription.updated":
          await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;
        case "customer.subscription.deleted":
          await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;
        case "charge.refunded":
          await handleChargeRefunded(event.data.object as Stripe.Charge);
          break;
        case "charge.dispute.created":
          await handleDisputeCreated(event.data.object as Stripe.Dispute);
          break;
        case "radar.early_fraud_warning.created":
          await handleEarlyFraudWarning(
            event.data.object as Stripe.Radar.EarlyFraudWarning,
          );
          break;
        default:
          break;
      }
    });
    return NextResponse.json({ received: true, result });
  } catch (error) {
    log.error("Webhook handler failed", { error, eventType: event.type });
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
