"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { AEQUAN_CONTACT_EMAIL, AEQUAN_CONTACT_MAILTO } from "@/lib/brand/contact";
import { cn } from "@/app/utils/cn";

type LandingContactEmailProps = {
  className?: string;
};

/** Simple contact row: mailto + copy, no icon chrome. */
export function LandingContactEmail({ className }: LandingContactEmailProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(AEQUAN_CONTACT_EMAIL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // mailto remains available
    }
  }

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white px-5 py-5",
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          Email
        </p>
        <a
          href={AEQUAN_CONTACT_MAILTO}
          className="mt-2 block break-all font-display text-base font-semibold leading-snug tracking-tight text-[#1E324E] transition hover:text-[#345884] sm:text-lg"
        >
          {AEQUAN_CONTACT_EMAIL}
        </a>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <a
          href={AEQUAN_CONTACT_MAILTO}
          className="text-sm font-semibold text-[#345884] transition hover:text-[#1E324E]"
        >
          Apri client email
        </a>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-[#1E324E]"
          aria-label={copied ? "Email copiata" : "Copia indirizzo email"}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
              Copiata
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" aria-hidden />
              Copia
            </>
          )}
        </button>
      </div>
    </div>
  );
}
