import { Clock3 } from "lucide-react";
import { cn } from "@/app/utils/cn";

type DailySimQuotaBannerProps = {
  remaining: number;
  limit: number;
  used: number;
  className?: string;
};

export function DailySimQuotaBanner({
  remaining,
  limit,
  used,
  className,
}: DailySimQuotaBannerProps) {
  const exhausted = remaining <= 0;
  const pct = Math.min(100, Math.round((remaining / Math.max(1, limit)) * 100));

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border px-5 py-4 shadow-aequan-panel sm:flex-row sm:items-center sm:justify-between",
        exhausted
          ? "border-amber-200 bg-amber-50/90"
          : "border-border bg-panel-bg",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            exhausted ? "bg-amber-100 text-amber-700" : "bg-[#E4EAF3] text-[#345884]",
          )}
        >
          <Clock3 className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Simulazioni di oggi
          </p>
          <p className="mt-0.5 font-display text-lg font-semibold tabular-nums text-text-primary">
            {exhausted ? (
              <>Quota giornaliera esaurita</>
            ) : (
              <>
                Te ne restano{" "}
                <span className="text-[#345884]">{remaining}</span> su {limit}
              </>
            )}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {exhausted
              ? "Il contatore si resetta a mezzanotte (ora italiana)."
              : `Ne hai avviate ${used} oggi · si resettano ogni giorno a mezzanotte.`}
          </p>
        </div>
      </div>

      <div className="w-full sm:max-w-[200px]">
        <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-slate-500">
          <span>Disponibili</span>
          <span className="tabular-nums">
            {remaining}/{limit}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200/80">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              exhausted ? "bg-amber-400" : "bg-[#345884]",
            )}
            style={{ width: `${remaining <= 0 ? 0 : Math.max(6, pct)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
