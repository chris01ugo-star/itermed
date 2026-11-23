"use client";

import { useState } from "react";
import { ReferralApplyField } from "@/components/billing/BillingActions";
import { REFERRAL_INVITEE_BONUS, REFERRAL_INVITER_BONUS } from "@/lib/billing/plans";

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
  showApply = false,
  prefillCode,
}: {
  code: string;
  inviteUrl: string;
  invitedTotal: number;
  confirmed: number;
  pending: number;
  bonusEarned: number;
  recent: ReferralRow[];
  suspended: boolean;
  showApply?: boolean;
  prefillCode?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyInvite() {
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        try {
          await navigator.share({
            title: "Aequan",
            text: "Allenati su casi clinici con Aequan. Usa il mio invito:",
            url: inviteUrl,
          });
          return;
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") return;
        }
      }
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border shadow-aequan-panel">
      <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
        <div className="relative overflow-hidden bg-[#1E324E] px-6 py-7 text-white sm:px-8 sm:py-8">
          <span
            className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/[0.06]"
            aria-hidden
          />
          <span
            className="pointer-events-none absolute -bottom-16 right-16 h-32 w-32 rounded-full bg-white/[0.04]"
            aria-hidden
          />
          <p className="relative text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
            Invita un amico
          </p>
          <p className="relative mt-3 font-display text-5xl font-bold leading-none tracking-tight">
            +{REFERRAL_INVITER_BONUS}
          </p>
          <p className="relative mt-2 font-display text-xl font-semibold text-white">
            simulazioni per te
          </p>
          <p className="relative mt-2 max-w-sm text-sm leading-relaxed text-white/70">
            Lui ne riceve {REFERRAL_INVITEE_BONUS} al primo abbonamento. Un link, un collega, crediti in più.
          </p>

          {suspended ? (
            <p className="relative mt-5 rounded-lg bg-white/10 px-3 py-2 text-sm text-white/90">
              Il programma referral di questo account è sospeso.
            </p>
          ) : (
            <div className="relative mt-6 space-y-3">
              <button
                type="button"
                onClick={() => void copyInvite()}
                className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-[#1E324E] transition hover:bg-white/90"
              >
                {copied ? "Link copiato" : "Copia il link di invito"}
              </button>
              <p className="text-center font-mono text-[11px] tracking-[0.18em] text-white/45">
                {code}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col justify-center bg-[#F6F1E8] px-6 py-7 sm:px-8 sm:py-8">
          {showApply ? (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8A5A2B]">
                Codice amico
              </p>
              <p className="mt-2 font-display text-3xl font-bold tracking-tight text-[#1E324E]">
                +{REFERRAL_INVITEE_BONUS} extra
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                Inseriscilo prima di abbonarti. Il bonus arriva con il primo pagamento.
              </p>
              <div className="mt-5">
                <ReferralApplyField defaultCode={prefillCode} prominent />
              </div>
            </>
          ) : (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8A5A2B]">
                I tuoi inviti
              </p>
              <p className="mt-2 font-display text-4xl font-bold tabular-nums tracking-tight text-[#1E324E]">
                {confirmed}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {confirmed === 1 ? "collega abbonato" : "colleghi abbonati"}
                {pending > 0 ? ` · ${pending} in attesa` : ""}
              </p>
              <p className="mt-4 text-sm text-slate-500">
                {invitedTotal} link condivisi · {bonusEarned} crediti guadagnati
              </p>
            </>
          )}
        </div>
      </div>

      {recent.length > 0 ? (
        <ul className="divide-y divide-slate-100 border-t border-border bg-white px-6 text-sm">
          {recent.map((row, index) => (
            <li key={row.id} className="flex items-center justify-between py-2.5">
              <span className="text-slate-600">Invito #{index + 1}</span>
              <span className="text-xs font-medium text-slate-500">
                {STATUS_LABEL[row.status] ?? row.status}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
