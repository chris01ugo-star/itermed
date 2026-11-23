import Link from "next/link";
import { Wallet } from "lucide-react";

export function CreditsSnapshot({
  total,
  monthly,
  purchased,
  referral,
  planName,
}: {
  total: number;
  monthly: number;
  purchased: number;
  referral: number;
  planName: string | null;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-panel-bg px-5 py-4 shadow-aequan-panel sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E4EAF3] text-[#345884]">
          <Wallet className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            {planName ?? "Crediti simulazione"}
          </p>
          <p className="mt-0.5 font-display text-lg font-semibold tabular-nums text-text-primary">
            {total} crediti disponibili
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Piano {monthly} · Extra {purchased} · Referral {referral}
          </p>
        </div>
      </div>
      <Link
        href="/dashboard/billing"
        className="inline-flex h-10 items-center justify-center rounded-xl bg-[#1E324E] px-4 text-sm font-semibold text-white"
      >
        Gestisci piano
      </Link>
    </div>
  );
}
