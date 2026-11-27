"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Ticket, X } from "lucide-react";
import { EXTRA_CREDIT_PACK, type SaasPlanId } from "@/lib/billing/plans";
import { Spinner } from "@/components/ui/Spinner";
import { usePendingNav } from "@/components/ui/PendingNav";
import { Dialog, DialogContent } from "@/app/ui/dialog";

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
    throw new Error(
      data.error || data.message || `Operazione non riuscita (${res.status}).`,
    );
  }
  return data;
}

export function SubscribeButton({
  plan,
  referralCode,
  label,
  className,
  skipReferralPrompt = false,
}: {
  plan: SaasPlanId;
  referralCode?: string;
  label: string;
  className?: string;
  skipReferralPrompt?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [friendCode, setFriendCode] = useState(referralCode ?? "");
  const [error, setError] = useState<string | null>(null);
  const { begin } = usePendingNav();

  const closeConfirm = useCallback(() => {
    if (busy) return;
    setConfirmOpen(false);
    setError(null);
  }, [busy]);

  async function startCheckout(code?: string) {
    setError(null);
    setBusy(true);
    try {
      const trimmed = code?.trim();
      const data = await postJson("/api/billing/checkout", {
        type: "subscription",
        plan,
        ...(trimmed ? { referralCode: trimmed } : {}),
      });
      if (data.url) {
        begin();
        window.location.assign(data.url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout non disponibile.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setError(null);
          if (skipReferralPrompt) {
            void startCheckout(referralCode);
            return;
          }
          setFriendCode(referralCode ?? "");
          setConfirmOpen(true);
        }}
        className={
          className ??
          "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1E324E] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2A486D] disabled:opacity-60"
        }
      >
        {busy ? (
          <>
            <Spinner className="text-current" />
            Reindirizzamento…
          </>
        ) : (
          label
        )}
      </button>
      {error && !confirmOpen ? <p className="text-xs text-rose-700">{error}</p> : null}

      <Dialog open={confirmOpen} onClose={closeConfirm}>
        <DialogContent className="max-w-md overflow-hidden border border-slate-200 bg-white p-0 !border-slate-200 !shadow-[0_24px_64px_rgba(30,50,78,0.16)]">
          <div className="relative border-b border-slate-100 bg-gradient-to-b from-[#F5F8FC] to-white px-5 pb-4 pt-5">
            <button
              type="button"
              aria-label="Chiudi"
              disabled={busy}
              onClick={closeConfirm}
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-[#1E324E] disabled:opacity-50"
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
            <div className="flex items-start gap-3 pr-8">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#345884]/10 text-[#345884]">
                <Ticket className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 text-left">
                <h2 className="font-display text-base font-semibold tracking-tight text-[#1E324E]">
                  Hai un codice amico?
                </h2>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
                  Inseriscilo se un collega ti ha invitato. I crediti extra arrivano al primo
                  pagamento. Il codice è facoltativo.
                </p>
              </div>
            </div>
          </div>
          <form
            className="px-5 pt-4"
            onSubmit={(event) => {
              event.preventDefault();
              void startCheckout(friendCode.trim() ? friendCode : undefined);
            }}
          >
            <label
              className="block text-sm font-medium text-[#1E324E]"
              htmlFor={`friend-code-${plan}`}
            >
              Codice
            </label>
            <input
              id={`friend-code-${plan}`}
              value={friendCode}
              onChange={(e) => setFriendCode(e.target.value)}
              placeholder="Facoltativo"
              autoComplete="off"
              autoFocus
              spellCheck={false}
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-3.5 text-sm text-[#1E324E] outline-none placeholder:text-slate-400 focus:border-[#345884]/40 focus:bg-white focus:ring-4 focus:ring-[#345884]/10"
            />
            {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
            <div className="-mx-5 mt-4 flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-3.5">
              <button
                type="button"
                disabled={busy}
                onClick={closeConfirm}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[#1E324E] px-4 text-sm font-semibold text-white transition hover:bg-[#2A486D] disabled:opacity-60"
              >
                {busy ? (
                  <>
                    <Spinner className="text-current" />
                    Attendi…
                  </>
                ) : (
                  "Continua al pagamento"
                )}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function BuyExtraButton({ disabled }: { disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { begin } = usePendingNav();

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
            if (data.url) {
              begin();
              window.location.assign(data.url);
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : "Acquisto non disponibile.");
            setBusy(false);
          }
        }}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#1E324E]/20 bg-white px-4 py-2.5 text-sm font-semibold text-[#1E324E] transition hover:bg-[#F4F6F8] disabled:opacity-60"
      >
        {busy ? (
          <>
            <Spinner className="text-current" />
            Reindirizzamento…
          </>
        ) : (
          `Acquista 5 simulazioni extra — ${EXTRA_CREDIT_PACK.priceLabel}`
        )}
      </button>
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}

export function ManageSubscriptionButton({ className }: { className?: string } = {}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { begin } = usePendingNav();

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
            if (data.url) {
              begin();
              window.location.assign(data.url);
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : "Portale non disponibile.");
            setBusy(false);
          }
        }}
        className={
          className ??
          "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        }
      >
        {busy ? (
          <>
            <Spinner className="text-current" />
            Apertura portale…
          </>
        ) : (
          "Gestisci abbonamento"
        )}
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
              ? "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1E324E] px-4 text-sm font-semibold text-white disabled:opacity-60"
              : "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#345884] px-4 text-sm font-semibold text-white disabled:opacity-60"
          }
        >
          {busy ? (
            <>
              <Spinner className="text-current" />
              Verifica…
            </>
          ) : prominent ? (
            "Registra il codice"
          ) : (
            "Applica codice"
          )}
        </button>
      </div>
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </form>
  );
}
