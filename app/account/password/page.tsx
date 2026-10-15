import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { authOptions } from "@/lib/auth-options";
import { shouldForcePasswordChange } from "@/lib/auth/must-change-password";
import { prisma } from "@/lib/prisma";
import { ChangePasswordForm } from "./ChangePasswordForm";

export default async function ChangePasswordPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/login?callbackUrl=/account/password");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, mustChangePassword: true },
  });
  if (!dbUser || !shouldForcePasswordChange(dbUser)) {
    redirect("/dashboard");
  }

  return (
    <AuthShell brandLine="Prima di entrare in AEQUAN, scegli una password che conosci solo tu.">
      <div className="auth-form-enter">
        <ChangePasswordForm email={dbUser.email} />
      </div>
    </AuthShell>
  );
}
