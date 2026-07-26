"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

const fieldClassName =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#345884]/45 focus:ring-4 focus:ring-[#345884]/10";

export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Email o password non validi.");
      return;
    }
    window.location.href = callbackUrl;
  }

  return (
    <AuthShell brandLine="Continua le simulazioni cliniche e il coaching medico-legale sul tuo profilo.">
      <div className="auth-form-enter space-y-7">
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#345884]">
            Accesso
          </p>
          <h2 className="font-display text-[1.75rem] font-bold tracking-tight text-slate-900">
            Bentornato
          </h2>
          <p className="text-sm leading-relaxed text-slate-500">
            Entra per riprendere i casi e il profilo competenze.
          </p>
        </div>

        <div className="space-y-5">
          <GoogleSignInButton
            callbackUrl={callbackUrl}
            label="Accedi con Google"
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
                autoComplete="current-password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={fieldClassName}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-1 inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#1E324E] text-sm font-semibold text-white shadow-sm transition hover:bg-[#2A486D] disabled:opacity-60"
            >
              {loading ? "Accesso…" : "Entra in AEQUAN"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500">
          Non hai un account?{" "}
          <Link
            href="/signup"
            className="font-semibold text-[#1E324E] underline-offset-2 hover:underline"
          >
            Registrati
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
