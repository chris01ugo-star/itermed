-- CreateTable
CREATE TABLE "BetaWaitlistEntry" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "roleHint" TEXT,
    "source" TEXT NOT NULL DEFAULT 'landing',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BetaWaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BetaWaitlistEntry_email_key" ON "BetaWaitlistEntry"("email");

-- CreateIndex
CREATE INDEX "BetaWaitlistEntry_createdAt_idx" ON "BetaWaitlistEntry"("createdAt");
