"use client";

import { useActionState } from "react";
import { SignOutButton } from "@/components/auth/SignOutButton";
import {
  changeInitialPasswordAction,
  type ChangePasswordState,
} from "./actions";

const fieldClassName =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#345884]/45 focus:ring-4 focus:ring-[#345884]/10";

const initialState: ChangePasswordState = { status: "idle" };

export function ChangePasswordForm({ email }: { email: string | null }) {
  const [state, action, pending] = useActionState(changeInitialPasswordAction, initialState);

  return (
    <div className="space-y-7">
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#345884]">
          Primo accesso
        </p>
        <h2 className="font-display text-[1.75rem] font-bold tracking-tight text-slate-900">
          Cambia la password
        </h2>
        <p className="text-sm leading-relaxed text-slate-500">
          {email ? (
            <>
              L&apos;account <strong className="font-medium text-slate-700">{email}</strong> è stato
              creato da un amministratore. Imposta una password personale per continuare.
            </>
          ) : (
            <>
              Questo account è stato creato da un amministratore. Imposta una password personale
              per continuare.
            </>
          )}
        </p>
      </div>

      <form action={action} className="space-y-4">
        {state.status === "error" ? (
          <p
            role="alert"
            className="rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700"
          >
            {state.message}
          </p>
        ) : null}

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700" htmlFor="password">
            Nuova password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="Almeno 8 caratteri"
            className={fieldClassName}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700" htmlFor="confirm">
            Conferma password
          </label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="Ripeti la nuova password"
            className={fieldClassName}
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="mt-1 inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#1E324E] text-sm font-semibold text-white shadow-sm transition hover:bg-[#2A486D] disabled:opacity-60"
        >
          {pending ? "Salvataggio…" : "Salva e continua"}
        </button>
      </form>

      <div className="flex justify-center">
        <SignOutButton />
      </div>
    </div>
  );
}
