"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { AuthShell } from "@/components/auth/AuthShell";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

const fieldClassName =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#345884]/45 focus:ring-4 focus:ring-[#345884]/10";

export function SignupForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!acceptedTerms) {
      setError("Devi accettare Termini di servizio e Privacy Policy per registrarti.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          email: email.trim().toLowerCase(),
          password,
          acceptedTerms: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Registrazione non riuscita.");
        setLoading(false);
        return;
      }
      const sign = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });
      if (sign?.error) {
        setError("Account creato ma accesso automatico fallito. Prova ad accedere manualmente.");
        setLoading(false);
        return;
      }
      window.location.href = "/dashboard";
    } catch {
      setError("Errore di rete. Riprova.");
      setLoading(false);
    }
  }

  return (
    <AuthShell brandLine="Crea il profilo e inizia a allenarti su casi clinici realistici con feedback AI.">
      <div className="auth-form-enter space-y-7">
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#345884]">
            Registrazione
          </p>
          <h2 className="font-display text-[1.75rem] font-bold tracking-tight text-slate-900">
            Crea il tuo account
          </h2>
          <p className="text-sm leading-relaxed text-slate-500">
            Inizia gratis: simulazioni, report e linee guida.
          </p>
        </div>

        <div className="space-y-5">
          <GoogleSignInButton
            callbackUrl="/dashboard"
            label="Registrati con Google"
            disabled
          />

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-200" aria-hidden />
            <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
              email
            </span>
            <span className="h-px flex-1 bg-slate-200" aria-hidden />
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {error ? (
              <p className="rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
                {error}
              </p>
            ) : null}

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700" htmlFor="name">
                Nome <span className="font-normal text-slate-400">(opzionale)</span>
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                placeholder="Mario Rossi"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={fieldClassName}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                placeholder="nome@universita.it"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={fieldClassName}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                placeholder="Minimo 8 caratteri"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={fieldClassName}
              />
            </div>

            <label className="flex items-start gap-2.5 text-[12px] leading-relaxed text-slate-600">
              <input
                id="acceptedTerms"
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-[#1E324E] focus:ring-[#345884]/30"
                required
              />
              <span>
                Accetto i{" "}
                <Link
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[#1E324E] underline-offset-2 hover:underline"
                >
                  Termini
                </Link>{" "}
                e la{" "}
                <Link
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[#1E324E] underline-offset-2 hover:underline"
                >
                  Privacy Policy
                </Link>
                . <span className="text-rose-600">*</span>
              </span>
            </label>

            <button
              type="submit"
              disabled={loading || !acceptedTerms}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#1E324E] text-sm font-semibold text-white shadow-sm transition hover:bg-[#2A486D] disabled:opacity-60"
            >
              {loading ? "Creazione…" : "Crea account"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500">
          Hai già un account?{" "}
          <Link
            href="/login"
            className="font-semibold text-[#1E324E] underline-offset-2 hover:underline"
          >
            Accedi
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
