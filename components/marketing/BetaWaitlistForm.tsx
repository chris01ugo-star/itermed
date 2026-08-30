"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/app/utils/cn";

const ROLE_OPTIONS = [
  { value: "", label: "Ruolo (opzionale)" },
  { value: "medico", label: "Medico" },
  { value: "specializzando", label: "Specializzando" },
  { value: "studente", label: "Studente di medicina" },
  { value: "docente", label: "Docente / tutor" },
  { value: "altro", label: "Altro" },
];

type BetaWaitlistFormProps = {
  className?: string;
  compact?: boolean;
  /** Anchor target for #lista-attesa (only one instance should set this). */
  anchorId?: string;
};

export function BetaWaitlistForm({
  className,
  compact = false,
  anchorId,
}: BetaWaitlistFormProps) {
  const searchParams = useSearchParams();
  const betaFlag = searchParams.get("beta");

  const banner = useMemo(() => {
    if (betaFlag === "pending") {
      return "Il tuo account non è ancora abilitato alla beta. Lascia l'email: ti avviseremo appena aprirà un posto.";
    }
    if (betaFlag === "signup-closed") {
      return "La registrazione aperta è chiusa. Iscriviti alla lista d'attesa per richiedere l'accesso anticipato.";
    }
    return null;
  }, [betaFlag]);

  useEffect(() => {
    if (!anchorId || !betaFlag) return;
    const el = document.getElementById(anchorId);
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  }, [anchorId, betaFlag]);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [roleHint, setRoleHint] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/beta/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          name: name.trim() || undefined,
          roleHint: roleHint || undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? "Invio non riuscito. Riprova.");
        return;
      }
      setDone(true);
    } catch {
      setError("Errore di rete. Riprova tra poco.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div
        id={anchorId}
        className={cn(
          "rounded-2xl border border-emerald-200 bg-emerald-50/80 px-5 py-6 text-center",
          className,
        )}
      >
        <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" strokeWidth={1.75} />
        <p className="mt-3 font-display text-lg font-semibold text-[#1E324E]">
          Sei in lista
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
          Ti contatteremo a <span className="font-medium text-slate-800">{email}</span> quando
          apriremo l&apos;accesso alla beta.
        </p>
      </div>
    );
  }

  return (
    <form
      id={anchorId}
      onSubmit={onSubmit}
      className={cn(
        "rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_12px_40px_-20px_rgba(30,50,78,0.35)] sm:p-6",
        className,
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#345884]">
        Lista d&apos;attesa beta
      </p>
      <h3 className="mt-1 font-display text-xl font-bold tracking-tight text-[#1E324E]">
        Richiedi l&apos;accesso anticipato
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
        Lascia la tua email: selezioniamo i profili clinici e formativi per la fase di test.
      </p>

      {banner ? (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs leading-relaxed text-amber-900">
          {banner}
        </p>
      ) : null}

      <div className={cn("mt-4 space-y-3", compact && "space-y-2.5")}>
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="Email professionale"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#345884]/45 focus:bg-white focus:ring-4 focus:ring-[#345884]/10"
        />
        <input
          type="text"
          autoComplete="name"
          placeholder="Nome e cognome (opzionale)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#345884]/45 focus:bg-white focus:ring-4 focus:ring-[#345884]/10"
        />
        <select
          value={roleHint}
          onChange={(e) => setRoleHint(e.target.value)}
          className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-700 outline-none transition focus:border-[#345884]/45 focus:bg-white focus:ring-4 focus:ring-[#345884]/10"
        >
          {ROLE_OPTIONS.map((opt) => (
            <option key={opt.value || "empty"} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {error ? (
          <p className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1E324E] text-sm font-semibold text-white transition hover:bg-[#345884] disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Invio…
            </>
          ) : (
            "Iscrivimi alla beta"
          )}
        </button>
        <p className="text-center text-[11px] leading-relaxed text-slate-400">
          Nessuna spam. Solo aggiornamenti sull&apos;apertura della beta.{" "}
          <a href="/privacy" className="underline-offset-2 hover:text-slate-600 hover:underline">
            Privacy
          </a>
        </p>
      </div>
    </form>
  );
}
