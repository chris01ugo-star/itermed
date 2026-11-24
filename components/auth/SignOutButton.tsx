"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { cn } from "@/app/utils/cn";
import { Spinner } from "@/components/ui/Spinner";
import { usePendingNav } from "@/components/ui/PendingNav";

type SignOutButtonProps = {
  iconOnly?: boolean;
};

export function SignOutButton({ iconOnly = false }: SignOutButtonProps) {
  const [busy, setBusy] = useState(false);
  const { begin } = usePendingNav();

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        if (busy) return;
        setBusy(true);
        begin();
        void signOut({ callbackUrl: "/login" });
      }}
      title="Esci"
      aria-busy={busy}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-60",
        iconOnly ? "justify-center p-2" : "px-2.5 py-1.5",
      )}
    >
      {busy ? (
        <Spinner size={14} className="text-current" />
      ) : (
        <LogOut className="h-3.5 w-3.5 shrink-0" />
      )}
      {iconOnly ? null : busy ? "Uscita…" : "Esci"}
    </button>
  );
}
