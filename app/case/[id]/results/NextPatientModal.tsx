"use client";

import { useMemo } from "react";

const NEXT_CASES = [
  { caseId: "car-f01", label: "Uomo 58 anni, dolore toracico oppressivo" },
  { caseId: "car-m02", label: "Donna 67 anni, dispnea acuta e ortopnea" },
  { caseId: "car-f02", label: "Donna 42 anni, palpitazioni e frequenza elevata" },
  { caseId: "car-m03", label: "Uomo 71 anni, sincope e bradicardia" },
  { caseId: "car-d01", label: "Uomo 54 anni, dolore toracico lacerante al dorso" },
  { caseId: "car-d03", label: "Donna 60 anni, ipotensione e segni di shock" },
] as const;

function pickNextCase(currentCaseId?: string | null) {
  const current = currentCaseId?.trim().toLowerCase() ?? "";
  const pool = NEXT_CASES.filter((item) => item.caseId !== current);
  const list = pool.length > 0 ? pool : NEXT_CASES;
  return list[Math.floor(Math.random() * list.length)] ?? list[0];
}

export function NextPatientModal({ currentCaseId }: { currentCaseId?: string | null }) {
  const next = useMemo(() => pickNextCase(currentCaseId), [currentCaseId]);
  const href = `/dashboard/prassi/play/${encodeURIComponent(next.caseId)}`;

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 border-b border-[#FFC0CD] bg-[#FFEBEF] px-5 py-2.5 sm:px-7"
      role="status"
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span
          className="mt-1.5 h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#E11D48]"
          aria-hidden
        />
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#E11D48]">
            Accesso in arrivo
          </p>
          <p className="truncate text-[13px] font-semibold leading-snug text-[var(--aequan-brand-primary)]">
            {next.label}
          </p>
        </div>
      </div>
      <a
        href={href}
        className="inline-flex shrink-0 items-center bg-[#E11D48] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:brightness-95"
      >
        Prendi in carico
      </a>
    </div>
  );
}
