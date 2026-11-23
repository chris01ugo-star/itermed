import Link from "next/link";
import { Sparkles } from "lucide-react";

export function SubscribePrompt() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[#1E324E]/15 bg-panel-bg px-5 py-4 shadow-aequan-panel sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1E324E] text-white">
          <Sparkles className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Abbonamento richiesto
          </p>
          <p className="mt-0.5 font-display text-lg font-semibold text-text-primary">
            I casi della Prassi sono bloccati
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Scegli Start o Plus per sbloccare le simulazioni. I report già fatti restano consultabili.
          </p>
        </div>
      </div>
      <Link
        href="/dashboard/billing"
        className="inline-flex h-10 items-center justify-center rounded-xl bg-[#1E324E] px-4 text-sm font-semibold text-white"
      >
        Vedi i piani
      </Link>
    </div>
  );
}
