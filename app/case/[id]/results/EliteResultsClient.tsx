"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type {
  ClinicalDeltaRow,
  CoachingFeedback,
  EconomicAnalysis,
  LegalProtectionStatus,
} from "@/lib/services/evaluation-report-types";
import { cn } from "@/app/utils/cn";
import { SafeLlmText } from "@/components/ui/safe-llm-content";
import { ResultsRadarClient, type RadarDatum } from "./ResultsRadarClient";
import { EconomicBudgetGauge } from "./EconomicBudgetGauge";
import { GoldStandardCompare } from "./GoldStandardCompare";
import { AiTransparencyBadge } from "@/components/legal/AiTransparencyBadge";
import {
  CLINICAL_PASS_TRENTESIMI,
  clampPercentScore,
  safeDisplayTrentesimi,
} from "@/lib/scoring/trentesimi";
import {
  MACRO_AREA_WEIGHTS,
  dimensionContributionTrentesimi,
  legalConformityFormalLabel,
  resolveLegalConformity,
  type EmpathyBehavioralBreakdown,
  type LegalConformityStatus,
  type LegalRagFinding,
  type ScoreBreakdown,
  type ScoreMotivation,
} from "@/lib/services/evaluation-scoring";
import type { KillerSwitchTrace } from "@/lib/services/simulation-report-data";

/* ═══════════════════════════════════════════════════════════════════
 * AEQUAN CLINICAL-TECH — Design System tokens (report surface)
 * Palette desaturata: ardesia · salvia · ossido · zaffiro sordo
 * ═══════════════════════════════════════════════════════════════════ */

const AQ = {
  ink: "text-[#1C2430]",
  muted: "text-[#5C6570]",
  faint: "text-[#7A8494]",
  sage: "text-[#3F5A4C]",
  sageBg: "bg-[#4F6B5C]/[0.10]",
  sageBorder: "border-[#4F6B5C]/35",
  oxide: "text-[#7A4A38]",
  oxideBg: "bg-[#8B5A45]/[0.10]",
  oxideBorder: "border-[#8B5A45]/35",
  sapphire: "text-[#2F4A62]",
  sapphireBg: "bg-[#3D5A73]/[0.08]",
  sapphireBorder: "border-[#3D5A73]/30",
  amber: "text-[#8A5A28]",
  amberBg: "bg-[#C9893A]/[0.12]",
  amberBorder: "border-[#C9893A]/40",
  plate:
    "rounded-2xl border border-neutral-200/70 bg-[#FCFCFD] shadow-[0_1px_0_rgba(28,36,48,0.05)]",
  platePad: "p-7 md:p-9",
  hairline: "border-neutral-200/60",
  microLabel:
    "text-xs font-semibold uppercase tracking-[0.14em] text-[#7A8494]",
  body: "text-base leading-relaxed",
  bodySm: "text-sm leading-relaxed",
  title: "font-display text-xl font-bold tracking-tight md:text-2xl",
  subtitle: "font-display text-lg font-semibold tracking-tight md:text-xl",
} as const;

/** Coerce legacy string[] / partial objects into ScoreMotivation[]. Never throws. */
function normalizeMotivations(raw: unknown): ScoreMotivation[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw
    .map((item, index): ScoreMotivation | null => {
      if (typeof item === "string") {
        const text = item.trim();
        if (!text) return null;
        return {
          id: `legacy_${index}`,
          type: text.startsWith("−") || text.startsWith("-") ? "negative" : "neutral",
          text,
          scoreImpact: 0,
        };
      }
      if (!item || typeof item !== "object") return null;
      const rec = item as Record<string, unknown>;
      const text =
        typeof rec.text === "string"
          ? rec.text
          : typeof rec.message === "string"
            ? rec.message
            : "";
      if (!text.trim()) return null;
      const typeRaw = rec.type;
      const type: ScoreMotivation["type"] =
        typeRaw === "positive" || typeRaw === "negative" || typeRaw === "neutral"
          ? typeRaw
          : "neutral";
      const scoreImpact =
        typeof rec.scoreImpact === "number" && Number.isFinite(rec.scoreImpact)
          ? rec.scoreImpact
          : typeof rec.impactPoints === "number" && Number.isFinite(rec.impactPoints)
            ? rec.impactPoints
            : 0;
      const id =
        typeof rec.id === "string" && rec.id.trim()
          ? rec.id
          : `mot_${index}_${text.slice(0, 16)}`;
      const sourceRef =
        typeof rec.sourceRef === "string" && rec.sourceRef.trim()
          ? rec.sourceRef
          : undefined;
      return { id, type, text, scoreImpact, ...(sourceRef ? { sourceRef } : {}) };
    })
    .filter((m): m is ScoreMotivation => m != null);
}

function safeScore(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

type RadarDatumWithKey = RadarDatum & { key?: string };

type FatalErrorUi = {
  code: string;
  description: string;
};

type EliteResultsClientProps = {
  totalScore: number;
  radarData: RadarDatumWithKey[];
  dismissed?: boolean;
  strengths?: string[];
  weaknesses?: string[];
  correctSolution?: string;
  legalProtectionStatus?: LegalProtectionStatus;
  clinicalDeltaTable?: ClinicalDeltaRow[];
  economicAnalysis?: EconomicAnalysis;
  coachingFeedback?: CoachingFeedback;
  legalSources?: string[];
  killerSwitch?: KillerSwitchTrace;
  fatalErrors?: FatalErrorUi[];
  empathyBreakdown?: EmpathyBehavioralBreakdown | null;
  scoreBreakdown?: ScoreBreakdown | null;
};

const PILLARS: Array<{
  key: string;
  label: string;
  fallbackIndex: number;
  gradeWeight: number | null;
  scaleHint: string;
  code: string;
}> = [
  {
    key: "clinicalAccuracy",
    label: "Accuratezza Clinica",
    fallbackIndex: 0,
    gradeWeight: MACRO_AREA_WEIGHTS.clinicalDiagnostic,
    scaleHint: "30% · max 9/30 · ESC/AHA Classe I–III × registro esecutivo",
    code: "01",
  },
  {
    key: "legalComplianceGelliBianco",
    label: "Tutela Medico-Legale",
    fallbackIndex: 1,
    gradeWeight: MACRO_AREA_WEIGHTS.legalCompliance,
    scaleHint: "30% · max 9/30 · Scudo Legale RAG specialty (CONFORME / NON CONFORME)",
    code: "02",
  },
  {
    key: "prescribingAppropriateness",
    label: "Appropriatezza Esami",
    fallbackIndex: 2,
    gradeWeight: MACRO_AREA_WEIGHTS.examAppropriateness,
    scaleHint: "20% · max 6/30 · −25% per esame incongruente",
    code: "03",
  },
  {
    key: "economicSustainability",
    label: "Sostenibilità Economica",
    fallbackIndex: 3,
    gradeWeight: null,
    scaleHint: "Metrica analitica · Nomenclatore SSN × efficienza [0–100]%",
    code: "04",
  },
  {
    key: "empathy",
    label: "Empatia Clinica",
    fallbackIndex: 4,
    gradeWeight: MACRO_AREA_WEIGHTS.empathy,
    scaleHint: "20% · max 6/30 · Calgary-Cambridge × Art. 20/24",
    code: "05",
  },
];

const COACH_CARDS: Array<{
  key: keyof CoachingFeedback;
  label: string;
  code: string;
}> = [
  { key: "accuratezza", label: "Accuratezza clinica", code: "A" },
  { key: "tutelaLegale", label: "Tutela legale", code: "B" },
  { key: "economicita", label: "Economicità", code: "C" },
  { key: "empatia", label: "Empatia", code: "D" },
];

function resolvePillarScore(
  radarData: RadarDatumWithKey[],
  pillar: (typeof PILLARS)[number],
) {
  const byKey = radarData.find((d) => d.key === pillar.key);
  const raw = byKey?.score ?? radarData[pillar.fallbackIndex]?.score ?? 0;
  return clampPercentScore(raw);
}

function legalStatusMeta(status: LegalProtectionStatus["status"]) {
  switch (status) {
    case "PROTECTED":
      return {
        label: "Protetto",
        tone: "sage" as const,
      };
    case "PARTIALLY_EXPOSED":
      return {
        label: "Parzialmente esposto",
        tone: "sapphire" as const,
      };
    default:
      return {
        label: "Altamente esposto",
        tone: "oxide" as const,
      };
  }
}

/** Micro-indicatore geometrico di stato — 1px stroke, no iconography. */
function StatusDot({
  tone,
}: {
  tone: "sage" | "oxide" | "sapphire" | "neutral";
}) {
  const fill =
    tone === "sage"
      ? "bg-[#4F6B5C]"
      : tone === "oxide"
        ? "bg-[#8B5A45]"
        : tone === "sapphire"
          ? "bg-[#3D5A73]"
          : "bg-[#9AA3B0]";
  return (
    <span
      className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", fill)}
      aria-hidden
    />
  );
}

function StatusPill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "sage" | "oxide" | "sapphire" | "neutral";
}) {
  const styles =
    tone === "sage"
      ? cn(AQ.sage, AQ.sageBg, AQ.sageBorder)
      : tone === "oxide"
        ? cn(AQ.oxide, AQ.oxideBg, AQ.oxideBorder)
        : tone === "sapphire"
          ? cn(AQ.sapphire, AQ.sapphireBg, AQ.sapphireBorder)
          : "border-neutral-200/70 bg-neutral-100/60 text-[#5C6570]";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em]",
        styles,
      )}
    >
      <StatusDot tone={tone} />
      {children}
    </span>
  );
}

function Section({
  children,
  className,
  delayMs = 0,
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
}) {
  return (
    <section
      className={cn("results-section-enter", className)}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      {children}
    </section>
  );
}

/** Doppia piastra clinica — bordo ultra-sottile, padding breathable. */
function Plate({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn(AQ.plate, className)}>{children}</div>;
}

function PlateHeader({
  title,
  description,
  index,
}: {
  title: string;
  description?: string;
  index?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 border-b px-6 py-5 md:px-8",
        AQ.hairline,
      )}
    >
      <div className="min-w-0 space-y-1.5">
        <h2 className={cn(AQ.title, AQ.ink)}>{title}</h2>
        {description ? (
          <p className={cn(AQ.body, AQ.muted)}>{description}</p>
        ) : null}
      </div>
      {index ? (
        <span className={cn(AQ.microLabel, "shrink-0 tabular-nums")}>{index}</span>
      ) : null}
    </div>
  );
}

/** Collapsible generico — chiuso di default, header cliccabile. */
function ReportCollapsible({
  title,
  meta,
  tone = "neutral",
  children,
  className,
  defaultOpen = false,
}: {
  title: ReactNode;
  meta?: ReactNode;
  tone?: "sage" | "oxide" | "sapphire" | "amber" | "neutral";
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const toneBorder =
    tone === "sage"
      ? AQ.sageBorder
      : tone === "oxide"
        ? AQ.oxideBorder
        : tone === "sapphire"
          ? AQ.sapphireBorder
          : tone === "amber"
            ? AQ.amberBorder
            : AQ.hairline;
  const toneBg =
    tone === "sage"
      ? "bg-[#F4F7F5]"
      : tone === "oxide"
        ? "bg-[#FAF6F4]"
        : tone === "sapphire"
          ? "bg-[#F5F7F9]"
          : tone === "amber"
            ? "bg-[#FBF7F1]"
            : "bg-white/80";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border transition-colors",
        toneBorder,
        toneBg,
        className,
      )}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-black/[0.02]"
      >
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className={cn("text-sm font-semibold leading-snug md:text-base", AQ.ink)}>
            {title}
          </div>
          {meta ? <div className={cn("text-xs font-medium", AQ.faint)}>{meta}</div> : null}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 opacity-50 transition-transform duration-200",
            AQ.ink,
            isOpen && "rotate-180",
          )}
          strokeWidth={1.75}
          aria-hidden
        />
      </button>
      {isOpen ? (
        <div className={cn("border-t px-4 py-4", toneBorder)}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

function MotivationsAccordion({ items }: { items?: ScoreMotivation[] | null }) {
  const safeItems = normalizeMotivations(items);
  if (safeItems.length === 0) return null;

  return (
    <div className={cn("mt-5 space-y-2.5 border-t pt-4", AQ.hairline)}>
      <p className={cn(AQ.microLabel, "mb-1")}>
        Motivazioni · {safeItems.length}{" "}
        {safeItems.length === 1 ? "voce" : "voci"}
      </p>
      {(safeItems || []).map((item) => {
        const tone =
          item.type === "negative"
            ? ("oxide" as const)
            : item.type === "positive"
              ? ("sage" as const)
              : ("neutral" as const);
        const impactValue = safeScore(item.scoreImpact, 0);
        const impact =
          impactValue === 0
            ? null
            : impactValue > 0
              ? `+${impactValue}`
              : `${impactValue}`;
        const headline =
          item.text.length > 72 ? `${item.text.slice(0, 72).trim()}…` : item.text;

        return (
          <ReportCollapsible
            key={item.id || `mot_${item.text.slice(0, 20)}`}
            tone={tone}
            title={
              <span className="flex flex-wrap items-center gap-2">
                <StatusDot tone={tone === "neutral" ? "neutral" : tone} />
                <span>{headline}</span>
              </span>
            }
            meta={
              impact || item.sourceRef ? (
                <span className="flex flex-wrap items-center gap-2">
                  {impact ? (
                    <span className="tabular-nums font-semibold text-[#1C2430]">
                      Impatto {impact}
                    </span>
                  ) : null}
                  {item.sourceRef ? (
                    <span className="truncate text-[#2F4A62]">Fonte disponibile</span>
                  ) : null}
                </span>
              ) : (
                "Apri per il dettaglio analitico"
              )
            }
          >
            <p className={cn(AQ.body, AQ.ink)}>{item.text}</p>
            {item.sourceRef ? (
              <p
                className={cn(
                  "mt-3 flex items-start gap-2.5 text-sm font-medium leading-relaxed",
                  AQ.sapphire,
                )}
              >
                <span
                  className="mt-1.5 inline-block h-3.5 w-px shrink-0 bg-[#3D5A73]/55"
                  aria-hidden
                />
                <span>{item.sourceRef}</span>
              </p>
            ) : null}
          </ReportCollapsible>
        );
      })}
    </div>
  );
}

function ExpertAnalysisAccordion({
  title = "Analisi Esperta",
  analysis,
}: {
  title?: string;
  analysis?: string | null;
}) {
  const text = typeof analysis === "string" ? analysis.trim() : "";
  if (!text) return null;

  return (
    <div className="mt-5">
      <ReportCollapsible
        title={title}
        meta="Commento specialistico · chiudi/apri a scelta"
        tone="sapphire"
      >
        <p className={cn(AQ.body, AQ.ink)}>
          <SafeLlmText as="span" className="whitespace-pre-line">
            {text}
          </SafeLlmText>
        </p>
      </ReportCollapsible>
    </div>
  );
}

type EconomyRxRow = {
  examName: string;
  cost: number;
  reason?: string | null;
  examId?: string;
};

function formatEuro(value: number): string {
  return `€${safeScore(value, 0).toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function EconomyPrescriptionColumn({
  title,
  index,
  badge,
  emptyLabel,
  items,
  variant,
  totalLabel,
}: {
  title: string;
  index: string;
  badge: string;
  emptyLabel: string;
  items: EconomyRxRow[];
  variant: "virtuous" | "waste" | "omission";
  totalLabel: string;
}) {
  const total = items.reduce((sum, item) => sum + safeScore(item.cost, 0), 0);
  const skin =
    variant === "virtuous"
      ? {
          plate: "border-emerald-200/80 bg-emerald-50/50",
          header: "border-emerald-200/70",
          badge: "border-emerald-300 bg-emerald-100 text-emerald-800",
          cost: "text-emerald-800",
          card: "border-emerald-200/70 bg-white/80",
          tone: "sage" as const,
        }
      : variant === "waste"
        ? {
            plate: "border-rose-200/80 bg-rose-50/45",
            header: "border-rose-200/70",
            badge: "border-rose-300 bg-rose-100 text-rose-800",
            cost: "text-rose-800",
            card: "border-rose-200/70 bg-white/80",
            tone: "oxide" as const,
          }
        : {
            plate: "border-amber-200/80 bg-amber-50/50",
            header: "border-amber-200/70",
            badge: "border-amber-300 bg-amber-100 text-amber-900",
            cost: "text-amber-900",
            card: "border-amber-200/70 bg-white/80",
            tone: "amber" as const,
          };

  return (
    <div className={cn("overflow-hidden rounded-2xl border shadow-sm", skin.plate)}>
      <div
        className={cn(
          "flex items-start justify-between gap-3 border-b px-5 py-4 md:px-6",
          skin.header,
        )}
      >
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn(AQ.microLabel, "tabular-nums")}>{index}</span>
            <span
              className={cn(
                "inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
                skin.badge,
              )}
            >
              {badge}
            </span>
          </div>
          <h3 className={cn(AQ.subtitle, AQ.ink)}>{title}</h3>
          <p className={cn("text-sm font-semibold tabular-nums", skin.cost)}>
            {totalLabel} {formatEuro(total)}
          </p>
        </div>
        <span className={cn("text-sm font-semibold tabular-nums", AQ.faint)}>
          {items.length}
        </span>
      </div>

      <div className="space-y-3 px-4 py-4 md:px-5 md:py-5">
        {items.length === 0 ? (
          <p className={cn(AQ.bodySm, AQ.muted)}>{emptyLabel}</p>
        ) : (
          items.map((item, i) => (
            <ReportCollapsible
              key={item.examId ?? `${variant}_${i}_${item.examName}`}
              tone={skin.tone}
              className={skin.card}
              title={item.examName || "Prestazione"}
              meta={
                <span className={cn("font-semibold tabular-nums", skin.cost)}>
                  {formatEuro(safeScore(item.cost, 0))}
                </span>
              }
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={cn(
                      "inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide",
                      skin.badge,
                    )}
                  >
                    {badge}
                  </span>
                  <span className={cn("text-base font-bold tabular-nums", skin.cost)}>
                    {formatEuro(safeScore(item.cost, 0))}
                  </span>
                </div>
                {item.reason ? (
                  <p className={cn(AQ.body, AQ.muted)}>
                    <SafeLlmText as="span">{item.reason}</SafeLlmText>
                  </p>
                ) : (
                  <p className={cn(AQ.bodySm, AQ.faint)}>
                    Dettaglio motivazionale non disponibile per questa prestazione.
                  </p>
                )}
              </div>
            </ReportCollapsible>
          ))
        )}
      </div>
    </div>
  );
}

function MacroScoreCard({
  label,
  scaleHint,
  score,
  gradeWeight,
  motivations,
  badge,
  code,
  expertAnalysis,
  expertTitle,
  dimensionRows,
  clinicalAudit,
}: {
  label: string;
  scaleHint: string;
  score: number;
  gradeWeight: number | null;
  motivations?: ScoreMotivation[] | null;
  badge?: string | null;
  code: string;
  /** Analisi Esperta — registro psicologo comportamentale (Pilastro 1). */
  expertAnalysis?: string | null;
  expertTitle?: string;
  dimensionRows?: Array<{
    label: string;
    score: number;
    weight: number;
    met?: number;
    expected?: number;
  }> | null;
  clinicalAudit?: {
    executedIds?: string[] | null;
    omittedIds?: string[] | null;
    registryCount?: number | null;
  } | null;
}) {
  const safe = safeScore(score, 0);
  const contribution =
    gradeWeight != null ? dimensionContributionTrentesimi(safe, gradeWeight) : null;
  const safeMotivations = normalizeMotivations(motivations);
  const executedIds = Array.isArray(clinicalAudit?.executedIds)
    ? clinicalAudit!.executedIds!.filter(Boolean)
    : [];
  const omittedIds = Array.isArray(clinicalAudit?.omittedIds)
    ? clinicalAudit!.omittedIds!.filter(Boolean)
    : [];

  return (
    <article className={cn(AQ.plate, AQ.platePad, "flex flex-col")}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn(AQ.microLabel, "tabular-nums")}>{code}</span>
            <h3 className={cn(AQ.title, AQ.ink)}>
              {label}
            </h3>
          </div>
          {badge ? <StatusPill tone="oxide">{badge}</StatusPill> : null}
          <p className={cn(AQ.bodySm, AQ.faint)}>{scaleHint}</p>
        </div>

        <div className="shrink-0 text-right">
          <p
            className={cn(
              "font-display text-[2.25rem] font-semibold tabular-nums tracking-tight leading-none",
              AQ.ink,
            )}
          >
            {Math.round(safe)}
            <span className={cn("ml-0.5 text-base font-medium", AQ.faint)}>/100</span>
          </p>
          {contribution != null ? (
            <p className={cn("mt-2", AQ.microLabel)}>
              <span className="tabular-nums">{contribution}</span>
              <span className="opacity-60">/30</span>
            </p>
          ) : (
            <p className={cn("mt-2", AQ.microLabel)}>Radar</p>
          )}
        </div>
      </div>

      <div className="mt-6 h-px overflow-visible bg-neutral-200/80">
        <div
          className="h-px bg-[#3D5A73]/70 transition-all duration-700"
          style={{ width: `${Math.max(0, Math.min(100, safe))}%` }}
        />
      </div>

      {dimensionRows && dimensionRows.length > 0 ? (
        <ul className="mt-5 space-y-3">
          {dimensionRows.map((row) => (
            <li key={row.label}>
              <ReportCollapsible
                title={
                  <span className="flex flex-wrap items-baseline justify-between gap-2">
                    <span>{row.label}</span>
                    <span className="tabular-nums font-bold">
                      {Math.round(safeScore(row.score, 0))}/100
                    </span>
                  </span>
                }
                meta={`Peso ${Math.round(row.weight * 100)}%${
                  typeof row.met === "number" &&
                  typeof row.expected === "number" &&
                  row.expected > 0
                    ? ` · ${row.met}/${row.expected}`
                    : ""
                }`}
                tone="sapphire"
              >
                <p className={cn(AQ.body, AQ.muted)}>
                  Punteggio dimensione{" "}
                  <span className={cn("font-semibold tabular-nums", AQ.ink)}>
                    {Math.round(safeScore(row.score, 0))}/100
                  </span>
                  {" · "}
                  contributo ponderato sul pilastro.
                </p>
              </ReportCollapsible>
            </li>
          ))}
        </ul>
      ) : null}

      {clinicalAudit ? (
        <div className="mt-5">
          <ReportCollapsible
            title="Audit Classe I · registro esecutivo"
            meta={
              typeof clinicalAudit.registryCount === "number"
                ? `${clinicalAudit.registryCount} action ID registrati`
                : "Dettaglio azioni Classe I"
            }
            tone="sapphire"
          >
            {typeof clinicalAudit.registryCount === "number" ? (
              <p className={cn("mb-3", AQ.body, AQ.muted)}>
                Action ID registrati:{" "}
                <span className={cn("font-semibold tabular-nums", AQ.ink)}>
                  {clinicalAudit.registryCount}
                </span>
                {clinicalAudit.registryCount === 0
                  ? " — score azzerato (nessun offset arbitrario)"
                  : null}
              </p>
            ) : null}
            {executedIds.length > 0 ? (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {executedIds.map((id) => (
                  <span
                    key={id}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs font-semibold sm:text-sm",
                      AQ.sageBorder,
                      AQ.sageBg,
                      AQ.sage,
                    )}
                  >
                    ✓ {id}
                  </span>
                ))}
              </div>
            ) : (
              <p className={cn(AQ.body, AQ.oxide)}>Nessuna azione di Classe I conteggiata.</p>
            )}
            {omittedIds.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {omittedIds.slice(0, 8).map((id) => (
                  <span
                    key={id}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs font-semibold sm:text-sm",
                      AQ.oxideBorder,
                      AQ.oxideBg,
                      AQ.oxide,
                    )}
                  >
                    Omessa · {id}
                  </span>
                ))}
              </div>
            ) : null}
          </ReportCollapsible>
        </div>
      ) : null}

      <ExpertAnalysisAccordion title={expertTitle ?? "Analisi Esperta"} analysis={expertAnalysis} />

      <MotivationsAccordion items={safeMotivations} />
    </article>
  );
}

function LegalConformityCard({
  status,
  sourceRef,
  motivations,
  gradeWeight,
  expertAnalysis,
  rilievi,
}: {
  status?: LegalConformityStatus | null;
  sourceRef?: string | null;
  motivations?: ScoreMotivation[] | null;
  gradeWeight: number;
  expertAnalysis?: string | null;
  rilievi?: LegalRagFinding[] | null;
}) {
  const safeStatus: LegalConformityStatus = resolveLegalConformity(status ?? null);
  const conforme = safeStatus === "CONFORME";
  const formal = legalConformityFormalLabel(safeStatus);
  const mappedScore = conforme ? 100 : 0;
  const contribution = dimensionContributionTrentesimi(mappedScore, gradeWeight);
  const tone = conforme ? "sage" : "oxide";
  const safeMotivations = normalizeMotivations(motivations);
  const citation = typeof sourceRef === "string" && sourceRef.trim() ? sourceRef.trim() : null;
  const rows = Array.isArray(rilievi) ? rilievi : [];

  return (
    <article className={cn(AQ.plate, AQ.platePad, "flex flex-col")}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn(AQ.microLabel, "tabular-nums")}>02</span>
            <h3 className={cn(AQ.title, AQ.ink)}>
              Tutela Medico-Legale
            </h3>
          </div>
          <p className={cn(AQ.bodySm, AQ.faint)}>
            Scudo Legale · matrice RAG specialty · 30% · max 9/30
          </p>
        </div>
        <p className={cn("shrink-0", AQ.microLabel)}>
          <span className="tabular-nums">{contribution}</span>
          <span className="opacity-60">/30</span>
        </p>
      </div>

      <div className="mt-5">
        <StatusPill tone={tone}>{formal}</StatusPill>
      </div>

      {citation ? (
        <div className="mt-4">
          <ReportCollapsible
            title="Citazione normativa dinamica"
            meta={conforme ? "Esito conforme" : "Esito non conforme"}
            tone={conforme ? "sage" : "oxide"}
          >
            <p
              className={cn(
                "flex items-start gap-2.5 text-base font-medium leading-relaxed tracking-tight",
                conforme ? AQ.sage : AQ.oxide,
              )}
            >
              <span
                className={cn(
                  "mt-1.5 inline-block h-4 w-px shrink-0",
                  conforme ? "bg-[#4F6B5C]/60" : "bg-[#8B5A45]/60",
                )}
                aria-hidden
              />
              {citation}
            </p>
          </ReportCollapsible>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="mt-4">
          <ReportCollapsible
            title="Rilievi medico-legali deduplicati"
            meta={`${rows.length} fattispecie`}
            tone="sapphire"
          >
            <div className="max-h-64 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className={cn("sticky top-0 bg-white/95", AQ.muted)}>
                  <tr className="border-b border-neutral-200/80">
                    <th className="px-3 py-2.5 font-semibold">Fattispecie</th>
                    <th className="px-3 py-2.5 font-semibold">Esito</th>
                    <th className="px-3 py-2.5 font-semibold">Fonte RAG</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-neutral-100/90 align-top last:border-0"
                    >
                      <td className={cn("px-3 py-2.5 leading-relaxed", AQ.ink)}>
                        {row.fattispecie}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            "text-xs font-semibold uppercase tracking-wide",
                            row.compliance === "rispettato"
                              ? AQ.sage
                              : row.compliance === "non_applicabile"
                                ? AQ.faint
                                : AQ.oxide,
                          )}
                        >
                          {row.compliance}
                        </span>
                      </td>
                      <td className={cn("px-3 py-2.5 leading-relaxed", AQ.sapphire)}>
                        {row.sourceRef}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ReportCollapsible>
        </div>
      ) : null}

      <ExpertAnalysisAccordion
        title="Analisi Esperta · Perito CTU"
        analysis={expertAnalysis}
      />

      <MotivationsAccordion items={safeMotivations} />
    </article>
  );
}

export function EliteResultsClient({
  totalScore,
  radarData,
  dismissed,
  strengths = [],
  weaknesses = [],
  correctSolution,
  legalProtectionStatus,
  clinicalDeltaTable = [],
  economicAnalysis,
  coachingFeedback,
  legalSources = [],
  killerSwitch,
  fatalErrors = [],
  empathyBreakdown = null,
  scoreBreakdown = null,
}: EliteResultsClientProps) {
  const legalMeta = legalProtectionStatus
    ? legalStatusMeta(legalProtectionStatus?.status ?? "HIGHLY_EXPOSED")
    : null;

  const normalizedScore = safeDisplayTrentesimi(safeScore(totalScore, 0));
  const showKillerSwitchBanner =
    killerSwitch?.applied === true ||
    (normalizedScore < CLINICAL_PASS_TRENTESIMI && (fatalErrors?.length ?? 0) > 0);
  const killerCap = killerSwitch?.cap ?? 17.9;

  const sb = scoreBreakdown ?? null;
  const empathyTrace = sb?.empathy ?? empathyBreakdown ?? null;
  const empathyMotivations: ScoreMotivation[] = normalizeMotivations(
    sb?.empathy?.motivations?.length
      ? sb.empathy.motivations
      : empathyBreakdown?.motivations?.length
        ? empathyBreakdown.motivations
        : empathyTrace?.qualitativeLabel
          ? [
              {
                id: "emp_fallback_label",
                type: "neutral" as const,
                text: empathyTrace.qualitativeLabel,
                scoreImpact: 0,
                sourceRef:
                  "Rif. Framework Calgary-Cambridge · Codice Deontologia Medica Art. 20/24",
              },
            ]
          : [],
  );
  const empathyExpertAnalysis =
    empathyTrace?.expertAnalysis?.trim() ||
    empathyTrace?.qualitativeLabel ||
    null;
  const empathyDimensionRows = empathyTrace?.dimensions
    ? [
        {
          label: empathyTrace.dimensions.activeListening.label,
          score: empathyTrace.dimensions.activeListening.score,
          weight: empathyTrace.dimensions.activeListening.weight,
        },
        {
          label: empathyTrace.dimensions.emotionalValidation.label,
          score: empathyTrace.dimensions.emotionalValidation.score,
          weight: empathyTrace.dimensions.emotionalValidation.weight,
        },
        {
          label: empathyTrace.dimensions.clinicalContext.label,
          score: empathyTrace.dimensions.clinicalContext.score,
          weight: empathyTrace.dimensions.clinicalContext.weight,
        },
      ]
    : null;
  const empathyUrgencyBadge =
    empathyTrace?.urgencyMode === "acute_emergency"
      ? "Urgenza acuta — empatia concisa"
      : empathyTrace?.urgencyMode === "stable_exploratory"
        ? "Contesto stabile — esplorazione approfondita"
        : null;

  const legalConformity: LegalConformityStatus = resolveLegalConformity(
    sb?.legal?.conformityStatus ?? sb?.legal?.protectionLabel ?? null,
  );
  const legalSourceRef = sb?.legal?.sourceRef ?? null;

  const clinicalTrace = sb?.clinical ?? null;
  const clinicalExpertAnalysis = clinicalTrace?.expertAnalysis?.trim() || null;
  const clinicalDimensionRows = clinicalTrace?.dimensions
    ? [
        {
          label: clinicalTrace.dimensions.classIAdherence.label,
          score: clinicalTrace.dimensions.classIAdherence.score,
          weight: clinicalTrace.dimensions.classIAdherence.weight,
          met: clinicalTrace.dimensions.classIAdherence.met,
          expected: clinicalTrace.dimensions.classIAdherence.expected,
        },
        {
          label: clinicalTrace.dimensions.classIIIAvoidance.label,
          score: clinicalTrace.dimensions.classIIIAvoidance.score,
          weight: clinicalTrace.dimensions.classIIIAvoidance.weight,
          met: clinicalTrace.dimensions.classIIIAvoidance.met,
          expected: clinicalTrace.dimensions.classIIIAvoidance.expected,
        },
        {
          label: clinicalTrace.dimensions.diagnosticSequencing.label,
          score: clinicalTrace.dimensions.diagnosticSequencing.score,
          weight: clinicalTrace.dimensions.diagnosticSequencing.weight,
          met: clinicalTrace.dimensions.diagnosticSequencing.met,
          expected: clinicalTrace.dimensions.diagnosticSequencing.expected,
        },
      ]
    : null;
  const clinicalClassIBadge =
    clinicalTrace?.classI && clinicalTrace.classI.expected > 0
      ? `Classe I ${clinicalTrace.classI.executed}/${clinicalTrace.classI.expected}`
      : null;
  const clinicalIatrogenicBadge = clinicalTrace?.iatrogenicCritical
    ? "Danno Iatrogeno Critico — Classe III"
    : null;
  const clinicalBadge = clinicalIatrogenicBadge
    ? clinicalClassIBadge
      ? `${clinicalIatrogenicBadge} · ${clinicalClassIBadge}`
      : clinicalIatrogenicBadge
    : clinicalClassIBadge ??
      (clinicalTrace?.anamnesisCapped
        ? `Anamnesi ${safeScore(clinicalTrace.anamnesisCoveragePercent, 0)}% < 20%`
        : null);

  const referenceDocuments = Array.isArray(legalProtectionStatus?.referenceDocuments)
    ? legalProtectionStatus.referenceDocuments
    : [];

  const unnecessaryExpenses = Array.isArray(economicAnalysis?.unnecessaryExpenses)
    ? economicAnalysis.unnecessaryExpenses
    : [];
  const missedRequiredExams = Array.isArray(economicAnalysis?.missedRequiredExams)
    ? economicAnalysis.missedRequiredExams
    : [];

  const eco = sb?.economy ?? null;
  const ecoInappropriate =
    eco?.prescriptions?.inappropriate?.map((p) => ({
      examName: p.name,
      cost: p.costEuro,
      reason: p.sourceRef,
    })) ?? unnecessaryExpenses;
  const ecoOmissions =
    eco?.prescriptions?.omissions?.map((p) => ({
      examName: p.name,
      cost: p.costEuro,
      reason: p.sourceRef,
    })) ?? missedRequiredExams;
  const ecoVirtuous = eco?.prescriptions?.virtuous ?? [];

  const wastedEuro =
    typeof eco?.overPrescriptionWasteEuro === "number"
      ? safeScore(eco.overPrescriptionWasteEuro, 0)
      : ecoInappropriate.reduce((sum, item) => sum + safeScore(item?.cost, 0), 0);

  const actualSpent = safeScore(
    eco?.totalCostEuro ?? economicAnalysis?.actualSpent,
    0,
  );
  const idealSpend = safeScore(
    eco?.idealSpendEuro ?? eco?.budgetEuro ?? economicAnalysis?.targetBudget,
    0,
  );
  const targetBudget = idealSpend;
  const deltaSpend = safeScore(eco?.deltaSpendEuro, actualSpent - idealSpend);
  const overspend = deltaSpend > 0 ? deltaSpend : 0;
  const budgetRespected = deltaSpend <= 0;
  const economyExpertAnalysis = eco?.expertAnalysis?.trim() || null;
  const economyBadge = eco?.underPrescriptionApplied
    ? "Omissioni / falso risparmio"
    : eco?.appropriatenessCouplingApplied
      ? "Spreco / medicina difensiva"
      : eco?.qualitativeLabel
        ? eco.qualitativeLabel.slice(0, 48)
        : null;

  const safeFatalErrors = Array.isArray(fatalErrors) ? fatalErrors : [];
  const safeStrengths = Array.isArray(strengths) ? strengths : [];
  const safeWeaknesses = Array.isArray(weaknesses) ? weaknesses : [];
  const safeLegalSources = Array.isArray(legalSources) ? legalSources : [];
  const safeClinicalDelta = Array.isArray(clinicalDeltaTable) ? clinicalDeltaTable : [];
  const safeRadar = Array.isArray(radarData) ? radarData : [];

  return (
    <div className={cn("space-y-8", AQ.ink)}>
      <AiTransparencyBadge
        variant="report"
        className="results-section-enter border-neutral-200/60 bg-[#FCFCFD]/80"
      />

      {dismissed ? (
        <Section delayMs={40}>
          <div
            className={cn(
              AQ.plate,
              "flex items-start gap-3 px-6 py-4",
              AQ.sapphireBorder,
              AQ.sapphireBg,
            )}
          >
            <StatusDot tone="sapphire" />
            <p className={cn("text-sm leading-relaxed", AQ.sapphire)}>
              Caso abbandonato: i punteggi sono stati registrati a 0 su tutti gli assi.
            </p>
          </div>
        </Section>
      ) : null}

      {/* ── Hero score plate ─────────────────────────────────────── */}
      <Section delayMs={60}>
        <Plate className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_8%_0%,rgba(61,90,115,0.05),transparent_50%)]"
            aria-hidden
          />
          <div
            className={cn(
              "relative flex flex-col gap-8 md:flex-row md:items-end md:justify-between",
              AQ.platePad,
            )}
          >
            <div className="max-w-xl space-y-3">
              <p className={AQ.microLabel}>Aequan · Report di valutazione</p>
              <h1
                className={cn(
                  "font-display text-2xl font-bold tracking-tight md:text-3xl",
                  AQ.ink,
                )}
              >
                Valutazione clinica e medico-legale
              </h1>
              <p className={cn(AQ.body, AQ.muted)}>
                Analisi multidimensionale con delta Gold Standard, bilancio economico e coaching.
              </p>
            </div>

            <div className="shrink-0 text-left md:text-right">
              <p className={AQ.microLabel}>Score complessivo</p>
              <p
                className={cn(
                  "mt-2 font-display text-5xl font-semibold tabular-nums tracking-tight leading-none md:text-6xl",
                  AQ.ink,
                )}
              >
                {Math.round(normalizedScore * 10) / 10}
                <span className={cn("ml-1 text-xl font-medium", AQ.faint)}>/30</span>
              </p>
              <p className={cn("mt-2", AQ.microLabel)}>Scala trentesimi</p>
            </div>
          </div>

          {showKillerSwitchBanner ? (
            <div
              role="alert"
              className={cn(
                "relative mx-6 mb-6 rounded-xl border px-5 py-4 md:mx-8 md:mb-8",
                AQ.oxideBorder,
                AQ.oxideBg,
              )}
            >
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <StatusDot tone="oxide" />
                  <p className={cn(AQ.microLabel, AQ.oxide)}>
                    Bocciatura d&apos;ufficio · Killer-Switch
                  </p>
                </div>
                <p className={cn(AQ.body, AQ.oxide)}>
                  Il voto complessivo è limitato a {killerCap}/30 per errori clinici o legali
                  fatali. I punteggi parziali restano autentici sul radar: interviene solo il
                  totale.
                  {killerSwitch?.applied &&
                  typeof killerSwitch.rawTotalTrentesimi === "number" &&
                  typeof killerSwitch.finalTotalTrentesimi === "number"
                    ? ` Grezzo: ${killerSwitch.rawTotalTrentesimi}/30 → finale: ${killerSwitch.finalTotalTrentesimi}/30.`
                    : null}
                </p>
                {safeFatalErrors.length > 0 ? (
                  <ul className={cn("space-y-2", AQ.bodySm, AQ.oxide)}>
                    {(safeFatalErrors || []).map((error) => (
                      <li key={error.code} className="flex gap-2">
                        <span className="mt-2 inline-block h-px w-2.5 shrink-0 bg-[#8B5A45]/50" />
                        <span>
                          <span className="font-mono text-xs font-semibold opacity-80">
                            {error.code}
                          </span>
                          {" — "}
                          {error.description}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          ) : null}
        </Plate>
      </Section>

      {/* ── Scudo legale (senza border-left / icone oversized) ───── */}
      {legalProtectionStatus && legalMeta ? (
        <Section delayMs={100}>
          <Plate className={AQ.platePad}>
            <div className="flex flex-wrap items-center gap-2.5">
              <p className={AQ.microLabel}>Scudo legale</p>
              <StatusPill tone={legalConformity === "CONFORME" ? "sage" : "oxide"}>
                {legalConformityFormalLabel(legalConformity)}
              </StatusPill>
              {legalConformity === "CONFORME" ? null : (
                <StatusPill tone={legalMeta.tone}>{legalMeta.label}</StatusPill>
              )}
            </div>
            {sb?.legal?.expertAnalysis ? (
              <div className="mt-4">
                <ExpertAnalysisAccordion
                  title="Analisi Esperta · Perito CTU"
                  analysis={sb.legal.expertAnalysis}
                />
              </div>
            ) : legalProtectionStatus?.justification ? (
              <div className="mt-4">
                <ExpertAnalysisAccordion
                  title="Giustificazione scudo legale"
                  analysis={legalProtectionStatus.justification}
                />
              </div>
            ) : null}
            {legalSourceRef ? (
              <p className={cn("mt-3 text-sm font-semibold leading-relaxed", AQ.sapphire)}>
                {legalSourceRef}
              </p>
            ) : null}
            {Array.isArray(sb?.legal?.rilievi) && sb!.legal!.rilievi!.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {sb!.legal!.rilievi!.slice(0, 8).map((r) => (
                  <span
                    key={r.id}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs font-semibold",
                      AQ.hairline,
                      r.compliance === "rispettato" ? AQ.sage : AQ.oxide,
                    )}
                  >
                    {r.fattispecie.slice(0, 48)}
                  </span>
                ))}
              </div>
            ) : referenceDocuments.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {(referenceDocuments || []).map((doc) => (
                  <span
                    key={doc}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs font-semibold",
                      AQ.hairline,
                      AQ.sapphire,
                    )}
                  >
                    {doc}
                  </span>
                ))}
              </div>
            ) : null}
            {safeLegalSources.length > 0 ? (
              <p className={cn("mt-3 text-sm", AQ.faint)}>
                Fonti RAG specialty: {safeLegalSources.join(" · ")}
              </p>
            ) : null}
          </Plate>
        </Section>
      ) : null}

      {/* ── Macro-aree ──────────────────────────────────────────── */}
      <Section delayMs={140} className="space-y-6">
        <div className="space-y-2">
          <p className={AQ.microLabel}>Modulo di valutazione</p>
          <h2 className={cn(AQ.title, AQ.ink)}>
            Macro-aree
          </h2>
          <p className={cn("max-w-2xl", AQ.body, AQ.muted)}>
            Quattro dimensioni pesano sul voto /30 (30%+30%+20%+20%). Economia SSN è metrica
            analitica, distinta dall&apos;appropriatezza prescrittiva.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-7">
          <MacroScoreCard
            label="Accuratezza Clinica"
            scaleHint={PILLARS[0].scaleHint}
            score={resolvePillarScore(safeRadar, PILLARS[0])}
            gradeWeight={MACRO_AREA_WEIGHTS.clinicalDiagnostic}
            motivations={normalizeMotivations(sb?.clinical?.motivations)}
            code={PILLARS[0].code}
            badge={clinicalBadge}
            expertAnalysis={clinicalExpertAnalysis}
            expertTitle="Analisi Esperta · Professore di Clinica"
            dimensionRows={clinicalDimensionRows}
            clinicalAudit={{
              executedIds: clinicalTrace?.classI?.executedIds ?? [],
              omittedIds: clinicalTrace?.classI?.omittedIds ?? [],
              registryCount: Array.isArray(clinicalTrace?.executedActionIds)
                ? clinicalTrace.executedActionIds.length
                : null,
            }}
          />
          <LegalConformityCard
            status={legalConformity}
            sourceRef={legalSourceRef}
            motivations={normalizeMotivations(sb?.legal?.motivations)}
            gradeWeight={MACRO_AREA_WEIGHTS.legalCompliance}
            expertAnalysis={sb?.legal?.expertAnalysis ?? null}
            rilievi={sb?.legal?.rilievi ?? null}
          />
          <MacroScoreCard
            label="Appropriatezza Esami"
            scaleHint={PILLARS[2].scaleHint}
            score={resolvePillarScore(safeRadar, PILLARS[2])}
            gradeWeight={MACRO_AREA_WEIGHTS.examAppropriateness}
            motivations={normalizeMotivations(sb?.exams?.motivations)}
            code={PILLARS[2].code}
          />
          <MacroScoreCard
            label="Empatia Clinica"
            scaleHint={PILLARS[4].scaleHint}
            score={resolvePillarScore(safeRadar, PILLARS[4])}
            gradeWeight={MACRO_AREA_WEIGHTS.empathy}
            motivations={empathyMotivations}
            code={PILLARS[4].code}
            badge={empathyUrgencyBadge}
            expertAnalysis={empathyExpertAnalysis}
            expertTitle="Analisi Esperta · Psicologo comportamentale"
            dimensionRows={empathyDimensionRows}
          />
          <MacroScoreCard
            label="Sostenibilità Economica"
            scaleHint={PILLARS[3].scaleHint}
            score={resolvePillarScore(safeRadar, PILLARS[3])}
            gradeWeight={null}
            motivations={normalizeMotivations(sb?.economy?.motivations)}
            code={PILLARS[3].code}
            badge={economyBadge}
            expertAnalysis={economyExpertAnalysis}
            expertTitle="Analisi Esperta · Direttore Sanitario"
          />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <Plate className="lg:col-span-7">
            <PlateHeader
              title="Radar competenze vs target"
              description="Profilo multidimensionale della sessione."
              index="R.01"
            />
            <div className="h-80 w-full px-4 py-5 md:px-6 md:py-6">
              <ResultsRadarClient data={safeRadar} />
            </div>
          </Plate>

          <Plate className="lg:col-span-5">
            <PlateHeader
              title="Bilancio economico SSN"
              description="Spesa effettiva vs spesa ideale Gold Standard (Nomenclatore)."
              index="E.01"
            />
            <div className="space-y-4 px-6 py-5 md:px-8 md:py-6">
              {economicAnalysis || eco ? (
                <>
                  <div className={cn("rounded-xl border bg-white/70 p-4", AQ.hairline)}>
                    <EconomicBudgetGauge
                      targetBudget={targetBudget}
                      actualSpent={actualSpent}
                      wastedEuro={wastedEuro}
                      efficiencyPercent={eco?.efficiencyPercent}
                      scostamentoPercent={eco?.scostamentoPercent}
                      deltaSpendEuro={deltaSpend}
                    />
                  </div>
                  {overspend > 0 ? (
                    <p
                      className={cn(
                        "flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-[11px]",
                        AQ.oxideBorder,
                        AQ.oxideBg,
                        AQ.oxide,
                      )}
                    >
                      <StatusDot tone="oxide" />
                      Delta spesa vs ideale GS: +€{overspend.toFixed(2)}.
                    </p>
                  ) : budgetRespected ? (
                    <p
                      className={cn(
                        "flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-[11px] font-medium",
                        AQ.sageBorder,
                        AQ.sageBg,
                        AQ.sage,
                      )}
                    >
                      <StatusDot tone="sage" />
                      Spesa entro o sotto la tariffazione ideale Gold Standard.
                    </p>
                  ) : null}
                  {economyExpertAnalysis ? (
                    <ExpertAnalysisAccordion
                      title="Analisi Esperta · Direttore Sanitario"
                      analysis={economyExpertAnalysis}
                    />
                  ) : null}
                  <MotivationsAccordion
                    items={normalizeMotivations(sb?.economy?.motivations)}
                  />
                </>
              ) : (
                <p
                  className={cn(
                    "rounded-xl border border-dashed px-4 py-10 text-center text-xs leading-relaxed",
                    AQ.hairline,
                    AQ.muted,
                  )}
                >
                  Bilancio economico non disponibile per questa sessione.
                </p>
              )}
            </div>
          </Plate>
        </div>
      </Section>

      {safeClinicalDelta.length > 0 ? (
        <Section delayMs={180}>
          <GoldStandardCompare rows={safeClinicalDelta} />
        </Section>
      ) : null}

      {(economicAnalysis || eco) &&
      (ecoInappropriate.length > 0 || ecoOmissions.length > 0 || ecoVirtuous.length > 0) ? (
        <Section delayMs={200} className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <Plate>
            <PlateHeader title="Prescrizioni virtuose" index="E.02" />
            <div className="space-y-2.5 px-6 py-5 md:px-8">
              {ecoVirtuous.length === 0 ? (
                <p className={cn("text-xs", AQ.muted)}>Nessuna prestazione virtuosa registrata.</p>
              ) : (
                ecoVirtuous.map((item) => (
                  <div
                    key={item.examId}
                    className={cn("rounded-xl border bg-white/50 px-4 py-3", AQ.hairline)}
                  >
                    <div className="flex justify-between gap-2">
                      <span className={cn("text-sm font-medium", AQ.ink)}>{item.name}</span>
                      <span className={cn("text-sm font-medium tabular-nums", AQ.sage)}>
                        €{safeScore(item.costEuro, 0).toFixed(2)}
                      </span>
                    </div>
                    <p className={cn("mt-1 text-[11px] leading-relaxed", AQ.sapphire)}>
                      {item.sourceRef}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Plate>

          <Plate>
            <PlateHeader title="Inappropriate / spreco" index="E.03" />
            <div className="space-y-2.5 px-6 py-5 md:px-8">
              {ecoInappropriate.length === 0 ? (
                <p className={cn("text-xs", AQ.muted)}>Nessuna spesa superflua rilevata.</p>
              ) : (
                ecoInappropriate.map((item, i) => (
                  <div
                    key={i}
                    className={cn("rounded-xl border bg-white/50 px-4 py-3", AQ.hairline)}
                  >
                    <div className="flex justify-between gap-2">
                      <span className={cn("text-sm font-medium", AQ.ink)}>
                        {item?.examName ?? "Esame"}
                      </span>
                      <span
                        className={cn(
                          "text-sm font-medium tabular-nums tracking-tight",
                          AQ.oxide,
                        )}
                      >
                        €{safeScore(item?.cost, 0).toFixed(2)}
                      </span>
                    </div>
                    <p className={cn("mt-1 text-[11px] leading-relaxed", AQ.muted)}>
                      {item?.reason ?? ""}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Plate>

          <Plate>
            <PlateHeader title="Omissioni (falso risparmio)" index="E.04" />
            <div className="space-y-2.5 px-6 py-5 md:px-8">
              {ecoOmissions.length === 0 ? (
                <p className={cn("text-xs", AQ.muted)}>Nessun esame obbligatorio omesso.</p>
              ) : (
                ecoOmissions.map((item, i) => (
                  <div
                    key={i}
                    className={cn("rounded-xl border bg-white/50 px-4 py-3", AQ.hairline)}
                  >
                    <div className="flex justify-between gap-2">
                      <span className={cn("text-sm font-medium", AQ.ink)}>
                        {item?.examName ?? "Esame"}
                      </span>
                      <span
                        className={cn(
                          "text-sm font-medium tabular-nums tracking-tight",
                          AQ.sapphire,
                        )}
                      >
                        €{safeScore(item?.cost, 0).toFixed(2)}
                      </span>
                    </div>
                    <p className={cn("mt-1 text-[11px] leading-relaxed", AQ.muted)}>
                      {item?.reason ?? ""}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Plate>
        </Section>
      ) : null}

      {coachingFeedback ? (
        <Section delayMs={220}>
          <Plate>
            <PlateHeader
              title="AI Clinical Coach"
              description="Feedback mirato sui quattro assi di coaching."
              index="C.01"
            />
            <div className="grid grid-cols-1 gap-4 px-6 py-5 md:grid-cols-2 md:px-8 md:py-6 xl:grid-cols-4">
              {COACH_CARDS.map(({ key, label, code }) => (
                <div
                  key={key}
                  className={cn("space-y-2.5 rounded-xl border bg-white/40 p-4", AQ.hairline)}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn(AQ.microLabel, "tabular-nums")}>{code}</span>
                    <span className={cn(AQ.microLabel)}>{label}</span>
                  </div>
                  <p className={cn("text-sm leading-relaxed", AQ.muted)}>
                    <SafeLlmText as="span" className="whitespace-pre-line">
                      {coachingFeedback[key] ?? ""}
                    </SafeLlmText>
                  </p>
                </div>
              ))}
            </div>
          </Plate>
        </Section>
      ) : null}

      <Section delayMs={240} className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Plate>
          <PlateHeader title="Punti di forza" index="S.01" />
          <div className="space-y-2 px-6 py-5 md:px-8">
            {safeStrengths.length === 0 ? (
              <p className={cn("text-xs", AQ.muted)}>Nessun punto di forza specifico.</p>
            ) : (
              <ul className="space-y-2">
                {(safeStrengths || []).map((item, idx) => (
                  <li
                    key={idx}
                    className={cn(
                      "flex gap-2.5 rounded-xl border bg-white/40 px-3.5 py-2.5 text-xs leading-relaxed",
                      AQ.hairline,
                      AQ.muted,
                    )}
                  >
                    <StatusDot tone="sage" />
                    <SafeLlmText as="span">{item}</SafeLlmText>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Plate>
        <Plate>
          <PlateHeader title="Aree di miglioramento" index="S.02" />
          <div className="space-y-2 px-6 py-5 md:px-8">
            {safeWeaknesses.length === 0 ? (
              <p className={cn("text-xs", AQ.muted)}>Nessuna criticità specifica.</p>
            ) : (
              <ul className="space-y-2">
                {(safeWeaknesses || []).map((item, idx) => (
                  <li
                    key={idx}
                    className={cn(
                      "flex gap-2.5 rounded-xl border bg-white/40 px-3.5 py-2.5 text-xs leading-relaxed",
                      AQ.hairline,
                      AQ.muted,
                    )}
                  >
                    <StatusDot tone="oxide" />
                    <SafeLlmText as="span">{item}</SafeLlmText>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Plate>
      </Section>

      {correctSolution ? (
        <Section delayMs={260}>
          <Plate>
            <PlateHeader
              title="Gestione esperta di riferimento"
              description="Percorso clinico atteso secondo il Gold Standard del caso."
              index="G.01"
            />
            <div className={cn("px-6 py-5 text-sm leading-relaxed md:px-8 md:py-6", AQ.muted)}>
              <SafeLlmText as="div" className="whitespace-pre-line">
                {correctSolution}
              </SafeLlmText>
            </div>
          </Plate>
        </Section>
      ) : null}
    </div>
  );
}
