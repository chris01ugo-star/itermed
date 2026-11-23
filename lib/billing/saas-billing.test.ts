/**
 * npx tsx --test lib/billing/saas-billing.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyMonthlyGrant,
  clampMonthlyToCap,
  EXTRA_CREDIT_PACK,
  pickConsumeBucket,
  REFERRAL_INVITEE_BONUS,
  REFERRAL_INVITER_BONUS,
  SAAS_PLANS,
  toSaasPlanId,
  toStoredPlanType,
  totalAvailableCredits,
} from "@/lib/billing/plans";
import { generateReferralCode, normalizeReferralCode } from "@/lib/billing/referral-code";
import { hasPaidSaasSubscription, shouldConsumeCredits } from "@/lib/billing/credit-policy";

function profile(
  overrides: {
    role?: string;
    email?: string;
    planType?: string;
    subscriptionStatus?: string | null;
    firstPaidAt?: Date | null;
  } = {},
) {
  return {
    email: "learner@example.com",
    role: "STUDENT",
    subscriptionStatus: null as string | null,
    planType: "FREE",
    firstPaidAt: null as Date | null,
    ...overrides,
  };
}

describe("Aequan SaaS plans", () => {
  it("1. Start grants 12 credits with monthly cap 24", () => {
    const start = SAAS_PLANS.START;
    assert.equal(start.monthlyPriceCents, 990);
    assert.equal(start.monthlyCredits, 12);
    assert.equal(start.monthlyCap, 24);
    const first = applyMonthlyGrant(0, start.monthlyCredits, start.monthlyCap);
    assert.equal(first.granted, 12);
    const second = applyMonthlyGrant(12, start.monthlyCredits, start.monthlyCap);
    assert.equal(second.granted, 12);
    const third = applyMonthlyGrant(24, start.monthlyCredits, start.monthlyCap);
    assert.equal(third.granted, 0);
    assert.equal(third.nextMonthly, 24);
  });

  it("2. Plus grants 30 credits with monthly cap 60", () => {
    const plus = SAAS_PLANS.PLUS;
    assert.equal(plus.monthlyPriceCents, 1690);
    const first = applyMonthlyGrant(0, plus.monthlyCredits, plus.monthlyCap);
    assert.equal(first.granted, 30);
    const capped = applyMonthlyGrant(50, plus.monthlyCredits, plus.monthlyCap);
    assert.equal(capped.granted, 10);
  });

  it("maps START/PLUS onto stored STUDENT/PREMIUM without dropping legacy rows", () => {
    assert.equal(toSaasPlanId("STUDENT"), "START");
    assert.equal(toSaasPlanId("PREMIUM"), "PLUS");
    assert.equal(toStoredPlanType("START"), "STUDENT");
    assert.equal(toStoredPlanType("PLUS"), "PREMIUM");
  });
});

describe("payments and credits", () => {
  it("3. failed payment does not grant credits (grant only after invoice.paid)", () => {
    const unpaid = applyMonthlyGrant(0, 0, 24);
    assert.equal(unpaid.granted, 0);
  });

  it("4. referral bonuses are 10 inviter / 5 invitee", () => {
    assert.equal(REFERRAL_INVITER_BONUS, 10);
    assert.equal(REFERRAL_INVITEE_BONUS, 5);
  });

  it("5. duplicate monthly grant keys are idempotent at the ledger math layer", () => {
    const periodBalance = applyMonthlyGrant(12, 12, 24);
    const duplicate = applyMonthlyGrant(periodBalance.nextMonthly, 0, 24);
    assert.equal(duplicate.granted, 0);
  });

  it("9. extra pack is 5 credits at 4,90 € and does not count toward monthly cap", () => {
    assert.equal(EXTRA_CREDIT_PACK.credits, 5);
    assert.equal(EXTRA_CREDIT_PACK.priceCents, 490);
    const monthly = applyMonthlyGrant(24, 12, 24);
    assert.equal(monthly.granted, 0);
    const total = totalAvailableCredits({
      monthlyBalance: 24,
      purchasedBalance: 5,
      referralBalance: 0,
    });
    assert.equal(total, 29);
  });

  it("10. exhausted wallet cannot pick a consume bucket", () => {
    assert.equal(
      pickConsumeBucket({ monthlyBalance: 0, purchasedBalance: 0, referralBalance: 0 }),
      null,
    );
  });

  it("13. concurrent last-credit: only monthly then purchased then referral", () => {
    assert.equal(
      pickConsumeBucket({ monthlyBalance: 1, purchasedBalance: 5, referralBalance: 10 }),
      "MONTHLY",
    );
    assert.equal(
      pickConsumeBucket({ monthlyBalance: 0, purchasedBalance: 1, referralBalance: 10 }),
      "PURCHASED",
    );
    assert.equal(
      pickConsumeBucket({ monthlyBalance: 0, purchasedBalance: 0, referralBalance: 1 }),
      "REFERRAL",
    );
  });

  it("14. plan change clamps monthly credits to the new cap and leaves extras", () => {
    assert.equal(clampMonthlyToCap(40, SAAS_PLANS.START.monthlyCap), 24);
    const extras = totalAvailableCredits({
      monthlyBalance: 24,
      purchasedBalance: 5,
      referralBalance: 10,
    });
    assert.equal(extras, 39);
  });
});

describe("referral codes", () => {
  it("6. personal codes match AEQUAN-XXXXX and are not sequential", () => {
    const a = generateReferralCode();
    const b = generateReferralCode();
    assert.match(a, /^AEQUAN-[A-Z2-9]{5}$/);
    assert.notEqual(a, b);
    assert.equal(normalizeReferralCode("aequan-x7k92"), "AEQUAN-X7K92");
    assert.equal(normalizeReferralCode("not-a-code"), null);
  });
});

describe("paid SaaS subscription", () => {
  it("does not treat admins as paying subscribers", () => {
    assert.equal(
      hasPaidSaasSubscription({
        role: "ADMIN",
        email: "dariobarbagallo46@gmail.com",
        planType: "FREE",
        subscriptionStatus: null,
      }),
      false,
    );
    assert.equal(
      hasPaidSaasSubscription({
        planType: "STUDENT",
        subscriptionStatus: "active",
      }),
      true,
    );
  });
});

describe("credit policy", () => {
  it("17. leftover bonus without an active subscription cannot start a paid session", () => {
    const canceled = profile({
      planType: "FREE",
      subscriptionStatus: "canceled",
      firstPaidAt: new Date(),
    });
    assert.equal(shouldConsumeCredits(canceled), false);
  });

  it("paid Start/Plus consume credits; admins never do", () => {
    assert.equal(
      shouldConsumeCredits(
        profile({
          planType: "STUDENT",
          subscriptionStatus: "active",
        }),
      ),
      true,
    );
    assert.equal(
      shouldConsumeCredits(
        profile({
          role: "ADMIN",
          email: "dariobarbagallo46@gmail.com",
          planType: "PREMIUM",
          subscriptionStatus: "active",
        }),
      ),
      false,
    );
  });

  it("8. cancel + reactivate is not a first payment (firstPaidAt already set)", () => {
    const reactivated = profile({
      planType: "STUDENT",
      subscriptionStatus: "active",
      firstPaidAt: new Date("2026-01-01"),
    });
    assert.ok(reactivated.firstPaidAt);
  });
});
