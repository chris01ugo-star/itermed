"use client";

import { useState } from "react";
import { cn } from "@/app/utils/cn";

export type WaterfallStepView = {
  label: string;
  delta: number;
  valueAfter: number;
  detail: string;
  kind: string;
};

export type ClinicalMatrixView = {
  physicalExams?: { performed?: Array<{ id: string; name: string; finding: string }>; omittedKey?: string[] };
  diagnosticExams?: {
    requested?: Array<{
      id: string;
      name: string;
      summary?: string;
      formattedText?: string;
      classification?: string;
      isAbnormal?: boolean | null;
    }>;
    omittedIndicated?: string[];
  };
  therapies?: {
    prescribed?: Array<{
      commercialName: string;
      route?: string;
      posology?: string;
      price?: number;
      valid?: boolean;
    }>;
    omittedIndicated?: string[];
  };
  stressSummary?: {
    initialStress?: number | null;
    finalStress?: number | null;
    peakStress?: number | null;
    timeline?: Array<{ atMinute?: number; stress: number; delta?: number; reason?: string }>;
    empathyImpact?: string;
  };
};

const KIND_LABEL: Record<string, string> = {
  base: "Base",
  blend: "Blend",
  bonus: "Bonus",
  penalty: "Penalità",
  rag_adj: "Linee guida",
  cap: "Tetto",
  final: "Finale",
};

export function WaterfallSteps({ steps }: { steps: WaterfallStepView[] }) {
  if (steps.length === 0) return null;
  return (
    <ol className="space-y-1.5">
      {steps.map((step, index) => (
        <li key={`${step.label}-${index}`} className="grid grid-cols-[7rem_4.5rem_1fr] gap-2 text-[12px]">
          <span className="font-semibold uppercase tracking-wide text-[var(--aequan-text-secondary)]">
            {KIND_LABEL[step.kind] ?? step.kind}
          </span>
          <span className="tabular-nums text-[var(--aequan-brand-primary)]">
            {step.delta > 0 ? `+${step.delta}` : step.delta}
            {" → "}
            {step.valueAfter}
          </span>
          <span className="text-[var(--aequan-text-secondary)]">
            <span className="font-medium text-[var(--aequan-text-primary)]">{step.label}. </span>
            {step.detail}
          </span>
        </li>
      ))}
    </ol>
  );
}

const TABS = [
  { id: "exam", label: "Esame obiettivo" },
  { id: "diag", label: "Diagnostica e referti" },
  { id: "therapy", label: "Terapia e posologia" },
  { id: "stress", label: "Stress e relazione" },
] as const;

export function ClinicalMatrixPanel({ matrix }: { matrix: ClinicalMatrixView }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("exam");
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide",
              tab === item.id
                ? "border-[var(--aequan-brand-primary)] bg-[var(--aequan-brand-primary)] text-white"
                : "border-[var(--aequan-border)] text-[var(--aequan-text-secondary)]",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-4 text-sm leading-relaxed text-[var(--aequan-text-primary)]">
        {tab === "exam" ? (
          <MatrixList
            done={(matrix.physicalExams?.performed ?? []).map(
              (exam) => `${exam.name}: ${exam.finding || "reperto non descritto"}`,
            )}
            missing={matrix.physicalExams?.omittedKey ?? []}
            doneLabel="Manovre eseguite"
            missingLabel="Manovre chiave omesse"
          />
        ) : null}
        {tab === "diag" ? (
          <MatrixList
            done={(matrix.diagnosticExams?.requested ?? []).map((exam) => {
              const report = exam.summary || exam.formattedText || "Referto non disponibile";
              return `${exam.name} · ${exam.classification ?? "appropriato"} · ${report}`;
            })}
            missing={matrix.diagnosticExams?.omittedIndicated ?? []}
            doneLabel="Esami richiesti"
            missingLabel="Esami indicati non richiesti"
          />
        ) : null}
        {tab === "therapy" ? (
          <MatrixList
            done={(matrix.therapies?.prescribed ?? []).map(
              (rx) =>
                `${rx.commercialName} · ${rx.route || "via n.d."} · ${rx.posology || "posologia n.d."} · SSN ${Number(rx.price ?? 0).toFixed(2)}€`,
            )}
            missing={matrix.therapies?.omittedIndicated ?? []}
            doneLabel="Farmaci prescritti"
            missingLabel="Farmaci indicati omessi"
          />
        ) : null}
        {tab === "stress" ? (
          <div className="space-y-2">
            <p>
              Iniziale {matrix.stressSummary?.initialStress ?? "n.d."} · finale{" "}
              {matrix.stressSummary?.finalStress ?? "n.d."} · picco {matrix.stressSummary?.peakStress ?? "n.d."}
            </p>
            <p className="text-[var(--aequan-text-secondary)]">
              {matrix.stressSummary?.empathyImpact || "Impatto sul voto di empatia non disponibile."}
            </p>
            <ul className="space-y-1">
              {(matrix.stressSummary?.timeline ?? []).slice(-8).map((event, index) => (
                <li key={`${event.atMinute ?? index}-${index}`}>
                  min {event.atMinute ?? "—"} · stress {event.stress}
                  {event.delta ? ` (${event.delta > 0 ? "+" : ""}${event.delta})` : ""}
                  {event.reason ? ` · ${event.reason}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MatrixList({
  done,
  missing,
  doneLabel,
  missingLabel,
}: {
  done: string[];
  missing: string[];
  doneLabel: string;
  missingLabel: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--aequan-text-secondary)]">
          {doneLabel}
        </p>
        <ul className="mt-2 space-y-1">
          {done.length > 0 ? done.map((item) => <li key={item}>{item}</li>) : <li>Nessun elemento registrato.</li>}
        </ul>
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--aequan-text-secondary)]">
          {missingLabel}
        </p>
        <ul className="mt-2 space-y-1">
          {missing.length > 0 ? missing.map((item) => <li key={item}>{item}</li>) : <li>Nessuna omissione segnalata.</li>}
        </ul>
      </div>
    </div>
  );
}

export function GuidelineEvidenceBox({
  items,
}: {
  items: Array<{ pillar: string; text: string; sources?: string[] }>;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-4 border border-[var(--aequan-border)] bg-[var(--aequan-panel-bg)] p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--aequan-text-secondary)]">
        Linee guida · Gelli-Bianco art. 5
      </p>
      <p className="mt-1 text-xs text-[var(--aequan-text-secondary)]">
        Citazioni di aderenza. Il voto dei cinque pilastri resta quello del motore ancorato.
      </p>
      <ul className="mt-3 space-y-3">
        {items.map((item) => (
          <li key={item.pillar}>
            <p className="text-xs font-semibold text-[var(--aequan-brand-primary)]">{item.pillar}</p>
            <p className="text-sm">{item.text}</p>
            {item.sources && item.sources.length > 0 ? (
              <p className="mt-1 text-[11px] text-[var(--aequan-text-secondary)]">{item.sources.slice(0, 4).join(" · ")}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
