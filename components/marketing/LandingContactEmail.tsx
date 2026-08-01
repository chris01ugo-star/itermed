"use client";

import { useState } from "react";
import { ArrowUpRight, Check, Copy, Mail } from "lucide-react";
import { AEQUAN_CONTACT_EMAIL, AEQUAN_CONTACT_MAILTO } from "@/lib/brand/contact";
import { cn } from "@/app/utils/cn";

type LandingContactEmailProps = {
  className?: string;
};

/** Primary contact action: open mail client + copy address. */
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
        "group relative flex min-h-[9.5rem] flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_18px_40px_-28px_rgba(30,50,78,0.45)] transition duration-300 hover:-translate-y-0.5 hover:border-[#345884]/35 hover:shadow-[0_22px_48px_-26px_rgba(30,50,78,0.55)] sm:p-6",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-[#345884]/10 blur-2xl transition group-hover:bg-[#345884]/16"
        aria-hidden
      />

      <div className="relative flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1E324E] text-white shadow-sm">
          <Mail className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-[#1E324E]"
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

      <div className="relative mt-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          Email
        </p>
        <a
          href={AEQUAN_CONTACT_MAILTO}
          className="mt-1.5 block break-all font-display text-xl font-semibold tracking-tight text-[#1E324E] transition hover:text-[#345884] sm:break-normal sm:text-2xl"
        >
          {AEQUAN_CONTACT_EMAIL}
        </a>
        <a
          href={AEQUAN_CONTACT_MAILTO}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#345884] transition group-hover:gap-2"
        >
          Apri client email
          <ArrowUpRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </a>
      </div>
    </div>
  );
}
