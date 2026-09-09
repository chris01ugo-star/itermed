"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { code39Bars } from "@/lib/reports/code39-svg";
import { reportWhatsAppShareHref } from "@/lib/reports/share-link";

type ReportShareBarcodeProps = {
  accession: string;
  shareUrl: string;
};

export function ReportShareBarcode({ accession, shareUrl }: ReportShareBarcodeProps) {
  const bars = useMemo(() => code39Bars(accession), [accession]);
  const [copied, setCopied] = useState(false);
  const whatsappHref = reportWhatsAppShareHref(shareUrl);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copia il link del referto", shareUrl);
    }
  }

  async function nativeShare() {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "Referto di valutazione · AEQUAN",
          text: "Ho appena completato un caso su AEQUAN. Ecco il Referto di valutazione.",
          url: shareUrl,
        });
        return;
      } catch {
        /* user cancelled or share failed — fall through */
      }
    }
    window.open(whatsappHref, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <a
        href={shareUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-sm bg-white px-1.5 py-1 ring-1 ring-[var(--aequan-border)]"
        title="Apri il link condivisibile del referto"
      >
        <svg
          role="img"
          aria-label={`Codice a barre ${accession}`}
          viewBox={`0 0 ${bars.width} ${bars.height}`}
          className="h-10 w-[9.5rem] text-[var(--aequan-brand-primary)] sm:h-11 sm:w-[11rem]"
          preserveAspectRatio="none"
        >
          <path d={bars.d} fill="currentColor" />
        </svg>
      </a>
      <p className="font-mono text-[10px] font-semibold tracking-[0.18em] text-[var(--aequan-brand-primary)]">
        {accession}
      </p>
      <div className="flex items-center gap-1.5">
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-sm border border-[var(--aequan-border)] bg-[var(--aequan-panel-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--aequan-brand-primary)] hover:bg-[var(--aequan-ui-bg)]"
        >
          WhatsApp
        </a>
        <button
          type="button"
          onClick={() => void copyLink()}
          className="inline-flex items-center gap-1 rounded-sm border border-[var(--aequan-border)] bg-[var(--aequan-panel-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--aequan-brand-primary)] hover:bg-[var(--aequan-ui-bg)]"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copiato" : "Copia link"}
        </button>
        <button
          type="button"
          onClick={() => void nativeShare()}
          className="inline-flex items-center gap-1 rounded-sm border border-[var(--aequan-border)] bg-[var(--aequan-panel-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--aequan-brand-primary)] hover:bg-[var(--aequan-ui-bg)]"
          aria-label="Condividi referto"
        >
          <Share2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
