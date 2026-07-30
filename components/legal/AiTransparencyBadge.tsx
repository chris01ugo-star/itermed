import Link from "next/link";
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
        "rounded-lg border border-slate-200/90 bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium leading-snug text-slate-700",
        className,
      )}
    >
      Stai interagendo con un sistema di Intelligenza Artificiale basato su modelli generativi.
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
