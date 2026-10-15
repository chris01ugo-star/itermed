"use server";

import { compare, hash } from "bcryptjs";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth-options";
import {
  shouldForcePasswordChange,
  validateNewPassword,
} from "@/lib/auth/must-change-password";
import { prisma } from "@/lib/prisma";

export type ChangePasswordState =
  | { status: "idle" }
  | { status: "error"; message: string };

export async function changeInitialPasswordAction(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return { status: "error", message: "Sessione scaduta. Accedi di nuovo." };
  }

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const validationError = validateNewPassword(password, confirm);
  if (validationError) {
    return { status: "error", message: validationError };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      passwordHash: true,
      mustChangePassword: true,
    },
  });
  if (!user) {
    return { status: "error", message: "Account non trovato." };
  }
  if (!shouldForcePasswordChange(user)) {
    redirect("/dashboard");
  }

  if (user.passwordHash && (await compare(password, user.passwordHash))) {
    return {
      status: "error",
      message: "Scegli una password diversa da quella temporanea.",
    };
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hash(password, 12),
      mustChangePassword: false,
    },
  });

  redirect("/dashboard");
}
