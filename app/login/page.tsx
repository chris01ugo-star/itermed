import { Suspense } from "react";
import { redirect } from "next/navigation";
import { isDevAuthBypass } from "../../lib/require-user";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  if (isDevAuthBypass()) {
    redirect("/dashboard");
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F4F6F8] text-sm text-slate-500">
          Caricamento…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
