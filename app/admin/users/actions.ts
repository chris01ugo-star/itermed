"use server";

import { revalidatePath } from "next/cache";
import { isPlatformAdminEmail } from "@/lib/auth/platform-admins";
import {
  effectiveEditableLimit,
  nextStoredFreeSimulationLimit,
  UNLIMITED_SIMULATION_SENTINEL,
} from "@/lib/billing/simulation-entitlement";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-user";

function revalidateUsers() {
  revalidatePath("/admin/users");
}

async function loadTarget(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      freeSimulationLimit: true,
    },
  });
}

export async function setUserRoleAction(formData: FormData) {
  const actor = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!userId) return;
  if (role !== "ADMIN" && role !== "STUDENT" && role !== "INSTRUCTOR") return;
  if (userId === actor.id && role !== "ADMIN") return;

  const target = await loadTarget(userId);
  if (!target) return;
  if (isPlatformAdminEmail(target.email) && role !== "ADMIN") return;

  await prisma.user.update({
    where: { id: userId },
    data: { role },
  });
  revalidateUsers();
}

export async function toggleUserActiveAction(formData: FormData) {
  const actor = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId || userId === actor.id) return;

  const target = await loadTarget(userId);
  if (!target) return;
  if (isPlatformAdminEmail(target.email)) return;

  await prisma.user.update({
    where: { id: userId },
    data: { isActive: !target.isActive },
  });
  revalidateUsers();
}

export async function adjustUserLimitAction(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const delta = Number(formData.get("delta"));
  if (!userId || !Number.isFinite(delta) || delta === 0) return;

  const target = await loadTarget(userId);
  if (!target) return;

  const current = effectiveEditableLimit(target);
  const next = nextStoredFreeSimulationLimit(current, delta);

  await prisma.user.update({
    where: { id: userId },
    data: { freeSimulationLimit: next },
  });
  revalidateUsers();
}

export async function setUserUnlimitedAction(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;

  const target = await loadTarget(userId);
  if (!target) return;

  const alreadyUnlimited = effectiveEditableLimit(target) === "unlimited";
  await prisma.user.update({
    where: { id: userId },
    data: {
      freeSimulationLimit: alreadyUnlimited ? 3 : UNLIMITED_SIMULATION_SENTINEL,
    },
  });
  revalidateUsers();
}
