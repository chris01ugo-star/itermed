"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { cn } from "@/app/utils/cn";

type GoogleSignInButtonProps = {
  callbackUrl?: string;
  label?: string;
  /** When true the button is visible but not clickable (e.g. OAuth not ready yet). */
  disabled?: boolean;
};

/** Official multi-colour "G" mark — kept as inline SVG so no extra brand-icon dependency is needed. */
function GoogleGlyph() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.7-3.87 2.7-6.62z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.16.28-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03l3-2.33z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97l3 2.33C4.66 5.17 6.65 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function GoogleSignInButton({
  callbackUrl = "/dashboard",
  label = "Continua con Google",
  disabled = false,
}: GoogleSignInButtonProps) {
  const [loading, setLoading] = useState(false);
  const isInactive = disabled || loading;

  return (
    <button
      type="button"
      disabled={isInactive}
      aria-disabled={isInactive}
      title={disabled ? "Disponibile a breve" : undefined}
      onClick={() => {
        if (disabled) return;
        setLoading(true);
        signIn("google", { callbackUrl }).catch(() => setLoading(false));
      }}
      className={cn(
        "inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 text-sm font-medium text-slate-700 transition-colors",
        disabled
          ? "cursor-not-allowed opacity-55"
          : "hover:border-slate-300 hover:bg-white disabled:opacity-60",
      )}
    >
      <GoogleGlyph />
      {loading ? "Reindirizzamento…" : label}
    </button>
  );
}
