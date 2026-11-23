import "server-only";
import Stripe from "stripe";
import { config } from "@/lib/config";

let stripeSingleton: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!config.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  if (!stripeSingleton) {
    stripeSingleton = new Stripe(config.STRIPE_SECRET_KEY, {
      typescript: true,
      appInfo: { name: "Aequan", url: "https://www.aequan.it" },
    });
  }

  return stripeSingleton;
}

export function isStripeConfigured(): boolean {
  return Boolean(config.STRIPE_SECRET_KEY);
}
