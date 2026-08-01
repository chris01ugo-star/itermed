"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { AEQUAN_CONTACT_EMAIL, AEQUAN_CONTACT_MAILTO } from "@/lib/brand/contact";

/** Large mailto + quiet copy control for the landing Contatti band. */
export function LandingContactEmail() {
  const [copied, setCopied] = useState(false);

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
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-2">
      <a
        href={AEQUAN_CONTACT_MAILTO}
        className="font-display text-xl font-semibold tracking-tight text-[#1E324E] transition-colors hover:text-[#345884] sm:text-2xl"
        aria-label={`Invia email a ${AEQUAN_CONTACT_EMAIL}`}
      >
        {AEQUAN_CONTACT_EMAIL}
      </a>
      <button
        type="button"
        onClick={() => void handleCopy()}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-[#1E324E]"
        aria-label={copied ? "Email copiata" : "Copia indirizzo email"}
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
            <span className="text-emerald-700">Copiata</span>
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
