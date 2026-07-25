"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { cn } from "@/app/utils/cn";

type SignOutButtonProps = {
  iconOnly?: boolean;
};

export function SignOutButton({ iconOnly = false }: SignOutButtonProps) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      title="Esci"
      className={cn(
        "inline-flex items-center gap-2 rounded-lg text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700",
        iconOnly ? "justify-center p-2" : "px-2.5 py-1.5",
      )}
    >
      <LogOut className="h-3.5 w-3.5 shrink-0" />
      {iconOnly ? null : "Esci"}
    </button>
  );
}
