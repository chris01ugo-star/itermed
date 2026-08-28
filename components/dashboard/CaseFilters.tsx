"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  type CaseDifficulty,
  DIFFICULTY_LABELS,
} from "@/lib/dashboard-case-utils";
import { ChevronDown, Gauge, Search, Stethoscope } from "lucide-react";
import { cn } from "@/app/utils/cn";

type MedicalSpecialtyOption = {
  id: string;
  name: string;
};

type CaseFiltersProps = {
  specialties: MedicalSpecialtyOption[];
  resultCount?: number;
  /** `prassi` uses rounded-xl controls instead of pill selects. */
  variant?: "default" | "prassi";
};

const DIFFICULTY_OPTIONS: CaseDifficulty[] = ["EASY", "MEDIUM", "HARD"];

export function CaseFilters({
  specialties,
  resultCount,
  variant = "default",
}: CaseFiltersProps) {
  const isPrassi = variant === "prassi";
  const router = useRouter();
  const pathname = usePathname() ?? "/dashboard/prassi";
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const activeSpecialtyId = searchParams?.get("specialtyId") ?? "";
  const activeDifficulty = searchParams?.get("difficulty") ?? "";
  const activeQuery = searchParams?.get("q") ?? "";
  const safeSpecialties = Array.isArray(specialties)
    ? specialties.filter((s) => s?.id && s?.name)
    : [];

  const [searchValue, setSearchValue] = useState(activeQuery);

  useEffect(() => {
    setSearchValue(activeQuery);
  }, [activeQuery]);

  const replaceParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      mutate(params);
      const query = params.toString();
      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    const trimmed = searchValue.trim();
    if (trimmed === activeQuery) return;
    const handle = window.setTimeout(() => {
      replaceParams((params) => {
        if (trimmed) params.set("q", trimmed);
        else params.delete("q");
      });
    }, 250);
    return () => window.clearTimeout(handle);
  }, [searchValue, activeQuery, replaceParams]);

  const selectWrapperClassName = (active: boolean) =>
    cn(
      "relative flex h-9 shrink-0 items-center border pl-8 pr-7 transition",
      isPrassi ? "rounded-xl" : "rounded-full",
      active
        ? "border-brand-primary/30 bg-brand-primary/[0.05]"
        : "border-border bg-ui-bg hover:border-slate-300",
    );

  const selectClassName = (active: boolean) =>
    cn(
      "h-full max-w-[10.5rem] appearance-none truncate bg-transparent text-sm outline-none",
      active ? "font-medium text-brand-primary" : "text-slate-700",
    );

  return (
    <div
      className={cn(
        "flex h-14 shrink-0 items-center justify-between gap-3 overflow-x-auto overflow-y-hidden border px-4 py-2",
        isPrassi
          ? "rounded-xl border-border bg-panel-bg shadow-aequan-panel"
          : "rounded-2xl border-slate-200 bg-gradient-to-b from-white to-slate-50/60 shadow-sm",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <div className="relative w-64 shrink-0 sm:w-72">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder={isPrassi ? "Cerca paziente o diagnosi…" : "Cerca caso…"}
            aria-label="Cerca caso clinico"
            className={cn(
              "h-9 w-full border border-border bg-ui-bg py-1.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-brand-primary/30 focus:bg-white focus:ring-2 focus:ring-brand-primary/10",
              isPrassi ? "rounded-xl" : "rounded-full border-slate-200 bg-slate-50",
            )}
          />
        </div>

        <span className="h-6 w-px shrink-0 bg-slate-200" aria-hidden />

        <label className={selectWrapperClassName(Boolean(activeSpecialtyId))}>
          <span className="sr-only">Specialità</span>
          <Stethoscope
            className={cn(
              "pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2",
              activeSpecialtyId ? "text-[#1E324E]" : "text-slate-400",
            )}
            aria-hidden
          />
          <select
            value={activeSpecialtyId}
            onChange={(e) => {
              const value = e.target.value;
              replaceParams((params) => {
                params.delete("specialty");
                if (value) params.set("specialtyId", value);
                else params.delete("specialtyId");
              });
            }}
            aria-label="Filtra per specialità"
            className={selectClassName(Boolean(activeSpecialtyId))}
          >
            <option value="">Tutte le specialità</option>
            {safeSpecialties.map((specialty) => (
              <option key={specialty.id} value={specialty.id}>
                {specialty.name}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
        </label>

        <label className={selectWrapperClassName(Boolean(activeDifficulty))}>
          <span className="sr-only">Difficoltà</span>
          <Gauge
            className={cn(
              "pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2",
              activeDifficulty ? "text-[#1E324E]" : "text-slate-400",
            )}
            aria-hidden
          />
          <select
            value={activeDifficulty}
            onChange={(e) => {
              const value = e.target.value;
              replaceParams((params) => {
                if (value) params.set("difficulty", value);
                else params.delete("difficulty");
              });
            }}
            aria-label="Filtra per difficoltà"
            className={selectClassName(Boolean(activeDifficulty))}
          >
            <option value="">Tutte le difficoltà</option>
            {DIFFICULTY_OPTIONS.map((difficulty) => (
              <option key={difficulty} value={difficulty}>
                {DIFFICULTY_LABELS[difficulty]}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
        </label>
      </div>

      {typeof resultCount === "number" ? (
        <span
          className={cn(
            "shrink-0 px-3 py-1 text-xs font-medium tabular-nums text-slate-600",
            isPrassi ? "rounded-lg bg-ui-bg" : "rounded-full bg-slate-100",
          )}
        >
          {resultCount}{" "}
          {isPrassi
            ? resultCount === 1
              ? "cartella"
              : "cartelle"
            : resultCount === 1
              ? "risultato"
              : "risultati"}
        </span>
      ) : null}
    </div>
  );
}
