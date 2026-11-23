"use client";

import { useMemo, useState } from "react";
import { Copy, Share2 } from "lucide-react";

type ReferralRow = {
  id: string;
  status: string;
  createdAt: Date | string;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "In attesa",
  CONFIRMED: "Confermato",
  CANCELED: "Annullato",
  INVALID: "Non valido",
};

export function ReferralInviteCard({
  code,
  inviteUrl,
  invitedTotal,
  confirmed,
  pending,
  bonusEarned,
  recent,
  suspended,
}: {
  code: string;
  inviteUrl: string;
  invitedTotal: number;
  confirmed: number;
  pending: number;
  bonusEarned: number;
  recent: ReferralRow[];
  suspended: boolean;
}) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const shareAvailable = useMemo(
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    [],
  );

  async function copy(text: string, kind: "code" | "link") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-panel-bg p-5 shadow-aequan-panel">
      <h2 className="font-display text-lg font-semibold text-[#1E324E]">Invita un collega</h2>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">
        Invita un collega, ottenete entrambi simulazioni gratuite. Tu ricevi 10 simulazioni bonus, il
        tuo collega ne riceve 5 dopo il pagamento del suo primo abbonamento.
      </p>

      {suspended ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Il programma referral di questo account è sospeso. Contatta Aequan se ritieni si tratti di
          un errore.
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <code className="flex-1 rounded-xl border border-slate-200 bg-[#F4F6F8] px-3 py-2.5 font-mono text-sm tracking-wide text-[#1E324E]">
          {code}
        </code>
        <button
          type="button"
          onClick={() => copy(code, "code")}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"
        >
          <Copy className="h-4 w-4" />
          {copied === "code" ? "Copiato" : "Copia codice"}
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => copy(inviteUrl, "link")}
          className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"
        >
          {copied === "link" ? "Link copiato" : "Copia link di invito"}
        </button>
        {shareAvailable ? (
          <button
            type="button"
            onClick={() => {
              void navigator.share({
                title: "Aequan",
                text: "Allenati su casi clinici con Aequan. Usa il mio invito:",
                url: inviteUrl,
              });
            }}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#345884] px-4 text-sm font-semibold text-white"
          >
            <Share2 className="h-4 w-4" />
            Condividi invito
          </button>
        ) : null}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Colleghi invitati", value: invitedTotal },
          { label: "Confermati", value: confirmed },
          { label: "In attesa", value: pending },
          { label: "Bonus guadagnati", value: bonusEarned },
        ].map((item) => (
          <div key={item.label} className="rounded-lg bg-ui-bg/80 px-3 py-2.5">
            <p className="text-[11px] text-slate-500">{item.label}</p>
            <p className="mt-0.5 font-display text-lg font-semibold tabular-nums text-[#1E324E]">
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {recent.length > 0 ? (
        <ul className="mt-4 divide-y divide-slate-100 text-sm">
          {recent.map((row, index) => (
            <li key={row.id} className="flex items-center justify-between py-2">
              <span className="text-slate-600">Invito #{index + 1}</span>
              <span className="text-xs font-medium text-slate-500">
                {STATUS_LABEL[row.status] ?? row.status}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-xs text-slate-500">Nessun invito inviato ancora.</p>
      )}
    </section>
  );
}
