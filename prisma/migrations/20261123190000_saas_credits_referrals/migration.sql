-- Additive SaaS billing: wallets, ledger, referrals. Existing user rows stay valid.

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "currentPeriodEnd" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "firstPaidAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "stripePaymentFingerprint" TEXT;

DO $$ BEGIN
  CREATE TYPE "CreditBucket" AS ENUM ('MONTHLY', 'PURCHASED', 'REFERRAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CreditTxnType" AS ENUM (
    'MONTHLY_GRANT',
    'SIMULATION_USE',
    'EXTRA_PACK',
    'REFERRAL_INVITER',
    'REFERRAL_INVITEE',
    'ADMIN_ADJUST',
    'REFUND_REVOKE',
    'PLAN_CHANGE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELED', 'INVALID');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "CreditWallet" (
    "userId" TEXT NOT NULL,
    "monthlyBalance" INTEGER NOT NULL DEFAULT 0,
    "purchasedBalance" INTEGER NOT NULL DEFAULT 0,
    "referralBalance" INTEGER NOT NULL DEFAULT 0,
    "monthlyGrantCap" INTEGER NOT NULL DEFAULT 0,
    "currentPeriodStart" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditWallet_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE IF NOT EXISTS "CreditTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "CreditTxnType" NOT NULL,
    "bucket" "CreditBucket" NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "paymentRef" TEXT,
    "sessionId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "note" TEXT,
    "actorUserId" TEXT,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CreditTransaction_idempotencyKey_key" ON "CreditTransaction"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CreditTransaction_userId_createdAt_idx" ON "CreditTransaction"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "CreditTransaction_sessionId_idx" ON "CreditTransaction"("sessionId");

CREATE TABLE IF NOT EXISTS "StripeProcessedEvent" (
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeProcessedEvent_pkey" PRIMARY KEY ("eventId")
);

CREATE TABLE IF NOT EXISTS "ReferralProfile" (
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "suspendedAt" TIMESTAMP(3),

    CONSTRAINT "ReferralProfile_pkey" PRIMARY KEY ("userId")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ReferralProfile_code_key" ON "ReferralProfile"("code");

CREATE TABLE IF NOT EXISTS "ReferralRedemption" (
    "id" TEXT NOT NULL,
    "inviterUserId" TEXT NOT NULL,
    "inviteeUserId" TEXT NOT NULL,
    "profileUserId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "checkoutSessionId" TEXT,
    "stripeCustomerId" TEXT,
    "paymentFingerprint" TEXT,
    "rewardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ReferralRedemption_inviteeUserId_key" ON "ReferralRedemption"("inviteeUserId");
CREATE UNIQUE INDEX IF NOT EXISTS "ReferralRedemption_checkoutSessionId_key" ON "ReferralRedemption"("checkoutSessionId");
CREATE INDEX IF NOT EXISTS "ReferralRedemption_inviterUserId_status_idx" ON "ReferralRedemption"("inviterUserId", "status");
CREATE INDEX IF NOT EXISTS "ReferralRedemption_paymentFingerprint_idx" ON "ReferralRedemption"("paymentFingerprint");

CREATE TABLE IF NOT EXISTS "CreditAdminAudit" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "bucket" "CreditBucket" NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditAdminAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CreditAdminAudit_targetUserId_createdAt_idx" ON "CreditAdminAudit"("targetUserId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "CreditWallet" ADD CONSTRAINT "CreditWallet_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ReferralProfile" ADD CONSTRAINT "ReferralProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ReferralRedemption" ADD CONSTRAINT "ReferralRedemption_inviterUserId_fkey"
    FOREIGN KEY ("inviterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ReferralRedemption" ADD CONSTRAINT "ReferralRedemption_inviteeUserId_fkey"
    FOREIGN KEY ("inviteeUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ReferralRedemption" ADD CONSTRAINT "ReferralRedemption_profileUserId_fkey"
    FOREIGN KEY ("profileUserId") REFERENCES "ReferralProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
