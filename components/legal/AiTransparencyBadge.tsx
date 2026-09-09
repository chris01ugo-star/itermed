import Link from "next/link";
import { Sparkles } from "lucide-react";
import { cn } from "@/app/utils/cn";

type AiTransparencyBadgeProps = {
  variant?: "workspace" | "report";
  className?: string;
};

const TRANSPARENCY_CLAIM =
  "Progettato in conformità con le linee guida di trasparenza e sicurezza del Regolamento UE sull'Intelligenza Artificiale (EU AI Act)";

/**
 * EU AI Act Art. 50 — interaction transparency notice for generative AI surfaces.
 */
export function AiTransparencyBadge({
  variant = "workspace",
  className,
}: AiTransparencyBadgeProps) {
  if (variant === "report") {
    return (
      <p
        role="note"
        className={cn(
          "rounded-xl border border-slate-200/90 bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-600",
          className,
        )}
      >
        Report generato ed elaborato tramite Intelligenza Artificiale ad uso puramente formativo.{" "}
        <Link
          href="/ai-transparency"
          className="font-medium text-[#1E324E] underline-offset-2 hover:underline"
        >
          Maggiori informazioni
        </Link>
      </p>
    );
  }

  return (
    <p
      role="note"
      aria-label="Avviso di trasparenza AI — Regolamento UE 2024/1689 Articolo 50"
      className={cn(
        "inline-flex max-w-[15.5rem] items-start gap-2 text-left sm:max-w-[18rem]",
        className,
      )}
    >
      <span
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#345884]/10 text-[#345884]"
        aria-hidden
      >
        <Sparkles className="h-3 w-3" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 text-[10px] leading-relaxed text-slate-500 sm:text-[11px]">
        Stai interagendo con un sistema di{" "}
        <span className="font-semibold text-slate-700">Intelligenza Artificiale</span>{" "}
        basato su modelli generativi.
      </span>
    </p>
  );
}

/** Soft marketing / footer claim — no “Compliant” overclaim. */
export function AiActSoftClaim({ className }: { className?: string }) {
  return (
    <span className={cn("text-xs leading-snug text-slate-500", className)}>{TRANSPARENCY_CLAIM}</span>
  );
}

export { TRANSPARENCY_CLAIM };
