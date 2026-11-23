import { z } from "zod";

export const CheckoutBodySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("subscription"),
    plan: z.enum(["STUDENT", "PREMIUM", "START", "PLUS"]),
    referralCode: z.string().max(32).optional(),
  }),
  z.object({
    type: z.literal("bundle"),
    bundleId: z.string().min(1).max(80),
  }),
  z.object({
    type: z.literal("extra_credits"),
  }),
]);

export type CheckoutBody = z.infer<typeof CheckoutBodySchema>;

export const ApplyReferralBodySchema = z.object({
  code: z.string().min(3).max(32),
});
