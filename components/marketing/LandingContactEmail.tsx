"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { AEQUAN_CONTACT_EMAIL, AEQUAN_CONTACT_MAILTO } from "@/lib/brand/contact";
import { cn } from "@/app/utils/cn";

type LandingContactEmailProps = {
  tone?: "onLight" | "onDark";
};

/** Large mailto + quiet copy control for the landing Contatti band. */
export function LandingContactEmail({ tone = "onLight" }: LandingContactEmailProps) {
  const [copied, setCopied] = useState(false);
  const onDark = tone === "onDark";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(AEQUAN_CONTACT_EMAIL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // mailto remains available
    }
  }

  return (
    <div className="flex min-w-0 flex-col items-center gap-2 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-3">
      <a
        href={AEQUAN_CONTACT_MAILTO}
        className={cn(
          "break-all font-display text-lg font-semibold tracking-tight transition-colors sm:break-normal sm:text-xl",
          onDark ? "text-white hover:text-white/85" : "text-[#1E324E] hover:text-[#345884]",
        )}
        aria-label={`Invia email a ${AEQUAN_CONTACT_EMAIL}`}
      >
        {AEQUAN_CONTACT_EMAIL}
      </a>
      <button
        type="button"
        onClick={() => void handleCopy()}
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-medium transition-colors",
          onDark
            ? "text-white/55 hover:text-white"
            : "text-slate-500 hover:text-[#1E324E]",
        )}
        aria-label={copied ? "Email copiata" : "Copia indirizzo email"}
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
            <span className={onDark ? "text-emerald-300" : "text-emerald-700"}>Copiata</span>
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" aria-hidden />
            <span>Copia</span>
          </>
        )}
      </button>
    </div>
  );
}
