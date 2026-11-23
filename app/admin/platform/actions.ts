"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { adminAdjustCredits } from "@/lib/billing/credit-ledger";
import type { CreditBucket } from "@prisma/client";

export async function adjustUserCreditsAction(formData: FormData): Promise<{
  ok: boolean;
  message: string;
}> {
  const actor = await requirePlatformAdmin();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const amount = Number(formData.get("amount"));
  const bucket = String(formData.get("bucket") ?? "MONTHLY") as CreditBucket;
  const reason = String(formData.get("reason") ?? "").trim();

  if (!email || !Number.isFinite(amount) || amount === 0) {
    return { ok: false, message: "Email e quantità sono obbligatori." };
  }
  if (!["MONTHLY", "PURCHASED", "REFERRAL"].includes(bucket)) {
    return { ok: false, message: "Bucket non valido." };
  }
  if (reason.length < 4) {
    return { ok: false, message: "Indica una motivazione (audit log)." };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) return { ok: false, message: "Utente non trovato." };

  await adminAdjustCredits({
    actorUserId: actor.id,
    targetUserId: user.id,
    bucket,
    amount: Math.trunc(amount),
    reason,
  });
  revalidatePath("/admin/platform");
  return { ok: true, message: "Rettifica registrata." };
}

export async function suspendReferralAction(formData: FormData): Promise<{
  ok: boolean;
  message: string;
}> {
  await requirePlatformAdmin();
  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase();
  if (!code) return { ok: false, message: "Codice mancante." };
  const profile = await prisma.referralProfile.findUnique({ where: { code } });
  if (!profile) return { ok: false, message: "Codice non trovato." };
  await prisma.referralProfile.update({
    where: { code },
    data: { suspendedAt: new Date() },
  });
  revalidatePath("/admin/platform");
  return { ok: true, message: "Referral sospeso." };
}
