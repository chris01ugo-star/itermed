"use server";

import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { isPlatformAdminEmail } from "@/lib/auth/platform-admins";
import {
  effectiveEditableLimit,
  MAX_ADMIN_FREE_SIMULATION_LIMIT,
  nextStoredFreeSimulationLimit,
  UNLIMITED_SIMULATION_SENTINEL,
} from "@/lib/billing/simulation-entitlement";
import { isAdminAssignableRole } from "@/lib/admin/user-roles";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-user";

export type CreateUserState =
  | { status: "idle" }
  | { status: "ok"; email: string }
  | { status: "error"; message: string };

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
  if (!isAdminAssignableRole(role)) return;
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
  if (isPlatformAdminEmail(target.email)) return;

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
  if (isPlatformAdminEmail(target.email)) return;

  const alreadyUnlimited = effectiveEditableLimit(target) === "unlimited";
  await prisma.user.update({
    where: { id: userId },
    data: {
      freeSimulationLimit: alreadyUnlimited ? 3 : UNLIMITED_SIMULATION_SENTINEL,
    },
  });
  revalidateUsers();
}

export async function createUserAction(
  _prev: CreateUserState,
  formData: FormData,
): Promise<CreateUserState> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const password = String(formData.get("password") ?? "");
  const roleRaw = String(formData.get("role") ?? "STUDENT").toUpperCase();
  const limitRaw = String(formData.get("freeSimulationLimit") ?? "3").trim();

  if (!name) {
    return { status: "error", message: "Inserisci il nome." };
  }
  if (!email.includes("@") || email.length < 5) {
    return { status: "error", message: "Inserisci un'email valida." };
  }
  if (password.length < 8) {
    return { status: "error", message: "La password deve avere almeno 8 caratteri." };
  }
  if (!isAdminAssignableRole(roleRaw)) {
    return { status: "error", message: "Ruolo non valido." };
  }
  if (isPlatformAdminEmail(email)) {
    return {
      status: "error",
      message: "Questa email è già un admin di piattaforma.",
    };
  }

  const parsedLimit = Number(limitRaw);
  if (!Number.isFinite(parsedLimit)) {
    return { status: "error", message: "Il limite casi non è valido." };
  }
  const freeSimulationLimit = Math.max(
    0,
    Math.min(MAX_ADMIN_FREE_SIMULATION_LIMIT, Math.floor(parsedLimit)),
  );

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return { status: "error", message: "Questa email è già registrata." };
  }

  const passwordHash = await hash(password, 12);
  const acceptedAt = new Date();

  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: roleRaw,
      planType: roleRaw === "ADMIN" ? "BETA_TESTER" : "INVITED",
      isActive: true,
      freeSimulationLimit: roleRaw === "ADMIN" ? UNLIMITED_SIMULATION_SENTINEL : freeSimulationLimit,
      termsAcceptedAt: acceptedAt,
      privacyAcceptedAt: acceptedAt,
    },
  });

  revalidateUsers();
  return { status: "ok", email };
}
