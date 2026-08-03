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
  muted: "text-[#6B7585]",
  faint: "text-[#8A93A1]",
  sage: "text-[#4F6B5C]",
  sageBg: "bg-[#4F6B5C]/[0.08]",
  sageBorder: "border-[#4F6B5C]/25",
  oxide: "text-[#8B5A45]",
  oxideBg: "bg-[#8B5A45]/[0.07]",
  oxideBorder: "border-[#8B5A45]/25",
  sapphire: "text-[#3D5A73]",
  sapphireBg: "bg-[#3D5A73]/[0.06]",
  sapphireBorder: "border-[#3D5A73]/20",
  plate:
    "rounded-2xl border border-neutral-200/60 bg-[#FCFCFD]/90 shadow-[0_1px_0_rgba(28,36,48,0.04)]",
  platePad: "p-6 md:p-8",
  hairline: "border-neutral-200/50",
  microLabel:
    "text-[10px] font-medium uppercase tracking-[0.16em] text-[#8A93A1]",
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
    scaleHint: "30% · max 9/30 · proporzionale al Gold Standard",
    code: "01",
  },
  {
    key: "legalComplianceGelliBianco",
    label: "Tutela Medico-Legale",
    fallbackIndex: 1,
    gradeWeight: MACRO_AREA_WEIGHTS.legalCompliance,
    scaleHint: "Valutazione giuridica binaria · 30% · max 9/30",
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
    scaleHint: "Metrica analitica · esclusa dal /30",
    code: "04",
  },
  {
    key: "empathy",
    label: "Empatia Clinica",
    fallbackIndex: 4,
    gradeWeight: MACRO_AREA_WEIGHTS.empathy,
    scaleHint: "20% · max 6/30",
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
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em]",
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
      <div className="min-w-0 space-y-1">
        <h2 className={cn("font-display text-sm font-semibold tracking-tight", AQ.ink)}>
          {title}
        </h2>
        {description ? (
          <p className={cn("text-xs leading-relaxed", AQ.muted)}>{description}</p>
        ) : null}
      </div>
      {index ? (
        <span className={cn(AQ.microLabel, "shrink-0 tabular-nums")}>{index}</span>
      ) : null}
    </div>
  );
}

function MotivationsAccordion({ items }: { items?: ScoreMotivation[] | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const safeItems = normalizeMotivations(items);
  if (safeItems.length === 0) return null;

  return (
    <div className={cn("mt-5 border-t pt-3", AQ.hairline)}>
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((v) => !v)}
        className={cn(
          "group flex w-full items-center justify-between gap-3 rounded-lg px-1 py-2 text-left transition-colors hover:bg-neutral-50/80",
        )}
      >
        <span className={cn(AQ.microLabel, "normal-case tracking-[0.1em]")}>
          Motivazioni Esperti · Analisi fonti
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 opacity-40 transition-transform duration-200",
            AQ.ink,
            isOpen && "rotate-180",
          )}
          strokeWidth={1.25}
          aria-hidden
        />
      </button>

      {isOpen ? (
        <div
          className={cn(
            "mt-2 rounded-xl border bg-[#F7F8F9]/80 px-4 py-4",
            AQ.hairline,
          )}
        >
          <ul className="space-y-3.5">
            {(safeItems || []).map((item) => {
              const tone =
                item.type === "negative"
                  ? AQ.oxide
                  : item.type === "positive"
                    ? AQ.sage
                    : AQ.ink;
              const impactValue = safeScore(item.scoreImpact, 0);
              const impact =
                impactValue === 0
                  ? null
                  : impactValue > 0
                    ? `+${impactValue}`
                    : `${impactValue}`;
              return (
                <li key={item.id || `mot_${item.text.slice(0, 20)}`} className="space-y-1">
                  <div
                    className={cn(
                      "flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 text-[12.5px] leading-snug",
                      tone,
                    )}
                  >
                    <StatusDot
                      tone={
                        item.type === "negative"
                          ? "oxide"
                          : item.type === "positive"
                            ? "sage"
                            : "neutral"
                      }
                    />
                    {impact ? (
                      <span className="shrink-0 font-medium tabular-nums tracking-tight">
                        {impact}
                      </span>
                    ) : null}
                    <span className="font-normal">{item.text}</span>
                  </div>
                  {item.sourceRef ? (
                    <p
                      className={cn(
                        "ml-3.5 flex items-start gap-2 text-[10.5px] leading-snug",
                        AQ.sapphire,
                      )}
                    >
                      <span
                        className="mt-[5px] inline-block h-2.5 w-px shrink-0 bg-[#3D5A73]/55"
                        aria-hidden
                      />
                      <span className="font-medium tracking-wide">{item.sourceRef}</span>
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
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
}: {
  label: string;
  scaleHint: string;
  score: number;
  gradeWeight: number | null;
  motivations?: ScoreMotivation[] | null;
  badge?: string | null;
  code: string;
}) {
  const safe = safeScore(score, 0);
  const contribution =
    gradeWeight != null ? dimensionContributionTrentesimi(safe, gradeWeight) : null;
  const safeMotivations = normalizeMotivations(motivations);

  return (
    <article className={cn(AQ.plate, AQ.platePad, "flex flex-col")}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn(AQ.microLabel, "tabular-nums")}>{code}</span>
            <h3 className={cn("font-display text-[15px] font-semibold tracking-tight", AQ.ink)}>
              {label}
            </h3>
          </div>
          {badge ? <StatusPill tone="oxide">{badge}</StatusPill> : null}
          <p className={cn("text-[11px] leading-relaxed", AQ.faint)}>{scaleHint}</p>
        </div>

        <div className="shrink-0 text-right">
          <p
            className={cn(
              "font-display text-[2rem] font-semibold tabular-nums tracking-tight leading-none",
              AQ.ink,
            )}
          >
            {Math.round(safe)}
            <span className={cn("ml-0.5 text-sm font-medium", AQ.faint)}>/100</span>
          </p>
          {contribution != null ? (
            <p className={cn("mt-1.5", AQ.microLabel)}>
              <span className="tabular-nums">{contribution}</span>
              <span className="opacity-60">/30</span>
            </p>
          ) : (
            <p className={cn("mt-1.5", AQ.microLabel)}>Radar</p>
          )}
        </div>
      </div>

      <div className="mt-5 h-px overflow-visible bg-neutral-200/80">
        <div
          className="h-px bg-[#3D5A73]/70 transition-all duration-700"
          style={{ width: `${Math.max(0, Math.min(100, safe))}%` }}
        />
      </div>

      <MotivationsAccordion items={safeMotivations} />
    </article>
  );
}

function LegalConformityCard({
  status,
  sourceRef,
  motivations,
  gradeWeight,
}: {
  status?: LegalConformityStatus | null;
  sourceRef?: string | null;
  motivations?: ScoreMotivation[] | null;
  gradeWeight: number;
}) {
  const safeStatus: LegalConformityStatus = resolveLegalConformity(status ?? null);
  const conforme = safeStatus === "CONFORME";
  const formal = legalConformityFormalLabel(safeStatus);
  const mappedScore = conforme ? 100 : 0;
  const contribution = dimensionContributionTrentesimi(mappedScore, gradeWeight);
  const tone = conforme ? "sage" : "oxide";
  const safeMotivations = normalizeMotivations(motivations);
  const citation = typeof sourceRef === "string" && sourceRef.trim() ? sourceRef.trim() : null;

  return (
    <article className={cn(AQ.plate, AQ.platePad, "flex flex-col")}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn(AQ.microLabel, "tabular-nums")}>02</span>
            <h3 className={cn("font-display text-[15px] font-semibold tracking-tight", AQ.ink)}>
              Tutela Medico-Legale
            </h3>
          </div>
          <p className={cn("text-[11px] leading-relaxed", AQ.faint)}>
            Valutazione giuridica binaria · 30% · max 9/30
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
        <div
          className={cn(
            "mt-4 rounded-xl border px-4 py-3",
            conforme ? cn(AQ.sageBorder, AQ.sageBg) : cn(AQ.oxideBorder, AQ.oxideBg),
          )}
        >
          <p className={cn(AQ.microLabel, "mb-1.5")}>Citazione normativa</p>
          <p
            className={cn(
              "flex items-start gap-2.5 text-[12.5px] font-medium leading-snug tracking-tight",
              conforme ? AQ.sage : AQ.oxide,
            )}
          >
            <span
              className={cn(
                "mt-1 inline-block h-3 w-px shrink-0",
                conforme ? "bg-[#4F6B5C]/60" : "bg-[#8B5A45]/60",
              )}
              aria-hidden
            />
            {citation}
          </p>
        </div>
      ) : null}

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
  const empathyMotivations: ScoreMotivation[] = normalizeMotivations(
    sb?.empathy?.motivations?.length
      ? sb.empathy.motivations
      : empathyBreakdown?.motivations?.length
        ? empathyBreakdown.motivations
        : empathyBreakdown
          ? [
              {
                id: "emp_fallback_floor",
                type: "positive" as const,
                text: "Competenza comunicativa professionale",
                scoreImpact: safeScore(empathyBreakdown.baseline, 0),
                sourceRef: "Rif. Modello comportamentale Aequan — empatia clinica",
              },
              ...(safeScore(empathyBreakdown.validationBonus, 0) > 0
                ? [
                    {
                      id: "emp_fallback_val",
                      type: "positive" as const,
                      text: "Validazione emotiva",
                      scoreImpact: safeScore(empathyBreakdown.validationBonus, 0),
                    },
                  ]
                : []),
              ...(safeScore(empathyBreakdown.transparencyBonus, 0) > 0
                ? [
                    {
                      id: "emp_fallback_trans",
                      type: "positive" as const,
                      text: "Trasparenza",
                      scoreImpact: safeScore(empathyBreakdown.transparencyBonus, 0),
                    },
                  ]
                : []),
              ...(safeScore(empathyBreakdown.allianceBonus, 0) > 0
                ? [
                    {
                      id: "emp_fallback_ally",
                      type: "positive" as const,
                      text: "Alleanza terapeutica",
                      scoreImpact: safeScore(empathyBreakdown.allianceBonus, 0),
                    },
                  ]
                : []),
              ...(safeScore(empathyBreakdown.dismissalPenalty, 0) > 0
                ? [
                    {
                      id: "emp_fallback_pen",
                      type: "negative" as const,
                      text: "Penalità comunicative",
                      scoreImpact: -safeScore(empathyBreakdown.dismissalPenalty, 0),
                    },
                  ]
                : []),
              {
                id: "emp_fallback_label",
                type: "neutral" as const,
                text: empathyBreakdown.qualitativeLabel || "Empatia clinica",
                scoreImpact: 0,
              },
            ]
          : [],
  );

  const legalConformity: LegalConformityStatus = resolveLegalConformity(
    sb?.legal?.conformityStatus ?? sb?.legal?.protectionLabel ?? null,
  );
  const legalSourceRef = sb?.legal?.sourceRef ?? null;

  const referenceDocuments = Array.isArray(legalProtectionStatus?.referenceDocuments)
    ? legalProtectionStatus.referenceDocuments
    : [];

  const unnecessaryExpenses = Array.isArray(economicAnalysis?.unnecessaryExpenses)
    ? economicAnalysis.unnecessaryExpenses
    : [];
  const missedRequiredExams = Array.isArray(economicAnalysis?.missedRequiredExams)
    ? economicAnalysis.missedRequiredExams
    : [];

  const wastedEuro = unnecessaryExpenses.reduce(
    (sum, item) => sum + safeScore(item?.cost, 0),
    0,
  );

  const actualSpent = safeScore(economicAnalysis?.actualSpent, 0);
  const targetBudget = safeScore(economicAnalysis?.targetBudget, 0);
  const overspend = actualSpent > targetBudget ? actualSpent - targetBudget : 0;
  const budgetRespected = actualSpent <= targetBudget;

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
            <p className={cn("text-xs leading-relaxed", AQ.sapphire)}>
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
                  "font-display text-[1.75rem] font-semibold tracking-tight md:text-[2rem]",
                  AQ.ink,
                )}
              >
                Valutazione clinica e medico-legale
              </h1>
              <p className={cn("text-sm leading-relaxed", AQ.muted)}>
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
                <p className={cn("text-xs leading-relaxed", AQ.oxide)}>
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
                  <ul className={cn("space-y-1.5 text-xs leading-relaxed", AQ.oxide)}>
                    {(safeFatalErrors || []).map((error) => (
                      <li key={error.code} className="flex gap-2">
                        <span className="mt-1.5 inline-block h-px w-2.5 shrink-0 bg-[#8B5A45]/50" />
                        <span>
                          <span className="font-mono text-[10px] opacity-70">{error.code}</span>
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
              <StatusPill tone={legalMeta.tone}>{legalMeta.label}</StatusPill>
            </div>
            <p className={cn("mt-4 text-sm leading-relaxed", AQ.muted)}>
              <SafeLlmText as="span" className="whitespace-pre-line">
                {legalProtectionStatus?.justification ?? ""}
              </SafeLlmText>
            </p>
            {referenceDocuments.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {(referenceDocuments || []).map((doc) => (
                  <span
                    key={doc}
                    className={cn(
                      "rounded-md border px-2 py-1 text-[10px] font-medium",
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
              <p className={cn("mt-3 text-[11px]", AQ.faint)}>
                Fonti RAG: {safeLegalSources.join(" · ")}
              </p>
            ) : null}
          </Plate>
        </Section>
      ) : null}

      {/* ── Macro-aree ──────────────────────────────────────────── */}
      <Section delayMs={140} className="space-y-5">
        <div className="space-y-1.5">
          <p className={AQ.microLabel}>Modulo di valutazione</p>
          <h2 className={cn("font-display text-base font-semibold tracking-tight", AQ.ink)}>
            Macro-aree
          </h2>
          <p className={cn("max-w-2xl text-xs leading-relaxed", AQ.muted)}>
            Quattro dimensioni pesano sul voto /30 (30%+30%+20%+20%). Economia SSN è metrica
            analitica, distinta dall&apos;appropriatezza prescrittiva.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <MacroScoreCard
            label="Accuratezza Clinica"
            scaleHint={PILLARS[0].scaleHint}
            score={resolvePillarScore(safeRadar, PILLARS[0])}
            gradeWeight={MACRO_AREA_WEIGHTS.clinicalDiagnostic}
            motivations={normalizeMotivations(sb?.clinical?.motivations)}
            code={PILLARS[0].code}
            badge={
              sb?.clinical?.anamnesisCapped
                ? `Anamnesi ${safeScore(sb.clinical.anamnesisCoveragePercent, 0)}% < 20%`
                : null
            }
          />
          <LegalConformityCard
            status={legalConformity}
            sourceRef={legalSourceRef}
            motivations={normalizeMotivations(sb?.legal?.motivations)}
            gradeWeight={MACRO_AREA_WEIGHTS.legalCompliance}
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
          />
          <MacroScoreCard
            label="Sostenibilità Economica"
            scaleHint={PILLARS[3].scaleHint}
            score={resolvePillarScore(safeRadar, PILLARS[3])}
            gradeWeight={null}
            motivations={normalizeMotivations(sb?.economy?.motivations)}
            code={PILLARS[3].code}
            badge={
              sb?.economy?.underPrescriptionApplied
                ? "Sotto-prescrizione pericolosa"
                : sb?.economy?.appropriatenessCouplingApplied
                  ? "Penalità da sovra-prescrizione"
                  : null
            }
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
              description="Budget assegnato vs spesa effettuata."
              index="E.01"
            />
            <div className="space-y-4 px-6 py-5 md:px-8 md:py-6">
              {economicAnalysis ? (
                <>
                  <div className={cn("rounded-xl border bg-white/70 p-4", AQ.hairline)}>
                    <EconomicBudgetGauge
                      targetBudget={targetBudget}
                      actualSpent={actualSpent}
                      wastedEuro={wastedEuro}
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
                      Sforamento budget: +€{overspend.toFixed(2)} rispetto al target SSN.
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
                      Budget rispettato — spesa entro soglia di appropriatezza.
                    </p>
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

      {economicAnalysis &&
      (unnecessaryExpenses.length > 0 || missedRequiredExams.length > 0) ? (
        <Section delayMs={200} className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Plate>
            <PlateHeader title="Spese superflue" index="E.02" />
            <div className="space-y-2.5 px-6 py-5 md:px-8">
              {unnecessaryExpenses.length === 0 ? (
                <p className={cn("text-xs", AQ.muted)}>Nessuna spesa superflua rilevata.</p>
              ) : (
                (unnecessaryExpenses || []).map((item, i) => (
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
            <PlateHeader title="Esami mancati" index="E.03" />
            <div className="space-y-2.5 px-6 py-5 md:px-8">
              {missedRequiredExams.length === 0 ? (
                <p className={cn("text-xs", AQ.muted)}>Nessun esame obbligatorio omesso.</p>
              ) : (
                (missedRequiredExams || []).map((item, i) => (
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
