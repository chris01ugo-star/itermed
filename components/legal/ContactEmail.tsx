"use client";

import { useState } from "react";
import { Check, Copy, Mail } from "lucide-react";
import {
  AEQUAN_CONTACT_EMAIL,
  AEQUAN_CONTACT_LABEL,
  AEQUAN_CONTACT_MAILTO,
} from "@/lib/brand/contact";

type ContactEmailProps = {
  /** Show the section label above/beside the address. Default true. */
  showLabel?: boolean;
  /** Compact footer row vs stacked block. */
  variant?: "inline" | "stacked";
  className?: string;
};

/**
 * Official contact mailto + optional copy-to-clipboard control.
 * Keeps the address non-wrapping on narrow screens where possible.
 */
export function ContactEmail({
  showLabel = true,
  variant = "inline",
  className = "",
}: ContactEmailProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(AEQUAN_CONTACT_EMAIL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be blocked; mailto remains available.
    }
  }

  const isStacked = variant === "stacked";

  return (
    <div
      className={[
        "flex min-w-0",
        isStacked ? "flex-col items-center gap-1.5 sm:items-start" : "flex-wrap items-center gap-x-2 gap-y-1",
        className,
      ].join(" ")}
    >
      {showLabel ? (
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          {AEQUAN_CONTACT_LABEL}
        </span>
      ) : null}

      <div className="flex min-w-0 max-w-full flex-wrap items-center justify-center gap-1.5 sm:justify-start">
        <a
          href={AEQUAN_CONTACT_MAILTO}
          className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-[12px] font-medium text-[#1E324E] underline-offset-2 transition-colors hover:bg-[#1E324E]/[0.04] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#345884]/40"
          aria-label={`Invia email a ${AEQUAN_CONTACT_EMAIL}`}
        >
          <Mail className="h-3.5 w-3.5 shrink-0 text-[#345884]" aria-hidden />
          <span className="min-w-0 break-all sm:break-normal">{AEQUAN_CONTACT_EMAIL}</span>
        </a>

        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-[#1E324E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#345884]/40"
          aria-label={copied ? "Email copiata" : "Copia indirizzo email"}
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-600" aria-hidden />
              <span className="text-emerald-700">Copiata</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" aria-hidden />
              <span>Copia</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
