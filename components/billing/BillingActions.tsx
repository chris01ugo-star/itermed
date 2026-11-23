"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EXTRA_CREDIT_PACK, type SaasPlanId } from "@/lib/billing/plans";

async function postJson(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as {
    url?: string;
    error?: string;
    message?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || "Operazione non riuscita.");
  }
  return data;
}

export function SubscribeButton({
  plan,
  referralCode,
  label,
  className,
}: {
  plan: SaasPlanId;
  referralCode?: string;
  label: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setError(null);
          setBusy(true);
          try {
            const data = await postJson("/api/billing/checkout", {
              type: "subscription",
              plan,
              ...(referralCode ? { referralCode } : {}),
            });
            if (data.url) window.location.assign(data.url);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Checkout non disponibile.");
            setBusy(false);
          }
        }}
        className={
          className ??
          "inline-flex min-h-11 items-center justify-center rounded-xl bg-[#1E324E] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2A486D] disabled:opacity-60"
        }
      >
        {busy ? "Reindirizzamento…" : label}
      </button>
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}

export function BuyExtraButton({ disabled }: { disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={busy || disabled}
        onClick={async () => {
          setError(null);
          setBusy(true);
          try {
            const data = await postJson("/api/billing/checkout", { type: "extra_credits" });
            if (data.url) window.location.assign(data.url);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Acquisto non disponibile.");
            setBusy(false);
          }
        }}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[#1E324E]/20 bg-white px-4 py-2.5 text-sm font-semibold text-[#1E324E] transition hover:bg-[#F4F6F8] disabled:opacity-60"
      >
        {busy
          ? "Reindirizzamento…"
          : `Acquista 5 simulazioni extra — ${EXTRA_CREDIT_PACK.priceLabel}`}
      </button>
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}

export function ManageSubscriptionButton({ className }: { className?: string } = {}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setError(null);
          setBusy(true);
          try {
            const data = await postJson("/api/billing/portal");
            if (data.url) window.location.assign(data.url);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Portale non disponibile.");
            setBusy(false);
          }
        }}
        className={
          className ??
          "inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        }
      >
        {busy ? "Apertura portale…" : "Gestisci abbonamento"}
      </button>
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}

export function ReferralApplyField({
  defaultCode = "",
  prominent = false,
}: {
  defaultCode?: string;
  prominent?: boolean;
}) {
  const [code, setCode] = useState(defaultCode);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        setMessage(null);
        try {
          const data = await postJson("/api/billing/referral/apply", { code });
          setMessage(data.message ?? "Codice applicato.");
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Codice non valido.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {prominent ? null : (
        <label className="block text-sm font-medium text-slate-700" htmlFor="referral-code">
          Codice invito (facoltativo)
        </label>
      )}
      <div className={prominent ? "space-y-3" : "flex flex-col gap-2 sm:flex-row"}>
        <input
          id="referral-code"
          aria-label={prominent ? "Codice amico" : undefined}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="AEQUAN-X7K92"
          className={
            prominent
              ? "h-12 w-full rounded-xl border border-[#1E324E]/15 bg-white px-3.5 text-sm outline-none focus:border-[#1E324E]/40 focus:ring-4 focus:ring-[#1E324E]/10"
              : "h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3.5 text-sm outline-none focus:border-[#345884]/45 focus:ring-4 focus:ring-[#345884]/10"
          }
        />
        <button
          type="submit"
          disabled={busy || !code.trim()}
          className={
            prominent
              ? "inline-flex h-12 w-full items-center justify-center rounded-xl bg-[#1E324E] px-4 text-sm font-semibold text-white disabled:opacity-60"
              : "inline-flex h-11 items-center justify-center rounded-xl bg-[#345884] px-4 text-sm font-semibold text-white disabled:opacity-60"
          }
        >
          {busy ? "Verifica…" : prominent ? "Sblocca +5 simulazioni" : "Applica codice"}
        </button>
      </div>
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </form>
  );
}
