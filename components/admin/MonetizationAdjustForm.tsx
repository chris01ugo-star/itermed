"use client";

import { useState } from "react";
import { adjustUserCreditsAction, suspendReferralAction } from "@/app/admin/platform/actions";

export function MonetizationAdjustForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const form = e.currentTarget;
          const result = await adjustUserCreditsAction(new FormData(form));
          setMessage(result.message);
          setBusy(false);
          if (result.ok) form.reset();
        }}
      >
        <h3 className="text-sm font-semibold text-slate-800">Rettifica crediti</h3>
        <input
          name="email"
          type="email"
          required
          placeholder="email utente"
          className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            name="amount"
            type="number"
            required
            placeholder="quantità (+/-)"
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
          />
          <select
            name="bucket"
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
            defaultValue="MONTHLY"
          >
            <option value="MONTHLY">Mensili</option>
            <option value="PURCHASED">Acquistati</option>
            <option value="REFERRAL">Referral</option>
          </select>
        </div>
        <input
          name="reason"
          required
          minLength={4}
          placeholder="Motivazione (audit)"
          className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
        />
        <button
          type="submit"
          disabled={busy}
          className="h-10 rounded-lg bg-[#1E324E] px-4 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Salvataggio…" : "Registra rettifica"}
        </button>
      </form>

      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const form = e.currentTarget;
          const result = await suspendReferralAction(new FormData(form));
          setMessage(result.message);
          setBusy(false);
          if (result.ok) form.reset();
        }}
      >
        <h3 className="text-sm font-semibold text-slate-800">Sospendi codice referral</h3>
        <input
          name="code"
          required
          placeholder="AEQUAN-X7K92"
          className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
        />
        <button
          type="submit"
          disabled={busy}
          className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-60"
        >
          Sospendi
        </button>
      </form>
      {message ? <p className="text-sm text-slate-600 lg:col-span-2">{message}</p> : null}
    </div>
  );
}
