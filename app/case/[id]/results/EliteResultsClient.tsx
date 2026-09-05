"use client";

import { useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  Euro,
  HeartHandshake,
  Scale,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type {
  ClinicalDeltaRow,
  CoachingFeedback,
  EconomicAnalysis,
  LegalProtectionStatus,
} from "@/lib/services/evaluation-report-types";
import { cn } from "@/app/utils/cn";
import { SafeLlmText } from "@/components/ui/safe-llm-content";
import { ResultsRadarClient, type RadarDatum } from "./ResultsRadarClient";
import { AiTransparencyBadge } from "@/components/legal/AiTransparencyBadge";
import {
  CLINICAL_PASS_TRENTESIMI,
  clampPercentScore,
  safeDisplayTrentesimi,
} from "@/lib/scoring/trentesimi";
import {
  MACRO_AREA_WEIGHTS,
  dimensionContributionTrentesimi,
  type EmpathyBehavioralBreakdown,
  type ScoreBreakdown,
  type ScoreMotivation,
} from "@/lib/services/evaluation-scoring";
import type { KillerSwitchTrace } from "@/lib/services/simulation-report-data";

type RadarDatumWithKey = RadarDatum & { key?: string };

type FatalErrorUi = {
  code: string;
  description: string;
};

type EliteResultsClientProps = {
  totalScore: number;
  radarData: RadarDatumWithKey[];
  caseTitle?: string | null;
  sessionId?: string | null;
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
  icon: LucideIcon;
  fallbackIndex: number;
  gradeWeight: number | null;
  coachKey?: keyof CoachingFeedback;
  breakdownKey?: keyof Pick<
    ScoreBreakdown,
    "clinical" | "legal" | "exams" | "economy" | "empathy"
  >;
}> = [
  {
    key: "clinicalAccuracy",
    label: "Clinica",
    icon: Stethoscope,
    fallbackIndex: 0,
    gradeWeight: MACRO_AREA_WEIGHTS.clinicalDiagnostic,
    coachKey: "accuratezza",
    breakdownKey: "clinical",
  },
  {
    key: "legalComplianceGelliBianco",
    label: "Tutela",
    icon: Scale,
    fallbackIndex: 1,
    gradeWeight: MACRO_AREA_WEIGHTS.legalCompliance,
    coachKey: "tutelaLegale",
    breakdownKey: "legal",
  },
  {
    key: "prescribingAppropriateness",
    label: "Esami",
    icon: Activity,
    fallbackIndex: 2,
    gradeWeight: MACRO_AREA_WEIGHTS.examAppropriateness,
    breakdownKey: "exams",
  },
  {
    key: "economicSustainability",
    label: "Economia",
    icon: Euro,
    fallbackIndex: 3,
    gradeWeight: null,
    coachKey: "economicita",
    breakdownKey: "economy",
  },
  {
    key: "empathy",
    label: "Empatia",
    icon: HeartHandshake,
    fallbackIndex: 4,
    gradeWeight: MACRO_AREA_WEIGHTS.empathy,
    coachKey: "empatia",
    breakdownKey: "empathy",
  },
];

const COACH_ROWS: Array<{ key: keyof CoachingFeedback; label: string }> = [
  { key: "accuratezza", label: "Clinica" },
  { key: "tutelaLegale", label: "Tutela" },
  { key: "economicita", label: "Economia" },
  { key: "empatia", label: "Empatia" },
];

function pickMotivationText(motivations: ScoreMotivation[] | undefined): string | null {
  if (!motivations?.length) return null;
  const negative = motivations.find((m) => m.type === "negative" && m.text?.trim());
  if (negative?.text?.trim()) return negative.text.trim();
  const any = motivations.find((m) => m.text?.trim());
  return any?.text?.trim() || null;
}

function resolvePillarInsight(
  pillar: (typeof PILLARS)[number],
  coachingFeedback: CoachingFeedback | undefined,
  scoreBreakdown: ScoreBreakdown | null | undefined,
  empathyNote: string | null,
  legalJustification: string | undefined,
): string | null {
  if (pillar.coachKey) {
    const coach = coachingFeedback?.[pillar.coachKey]?.trim();
    if (coach) return coach;
  }

  const slice = pillar.breakdownKey ? scoreBreakdown?.[pillar.breakdownKey] : null;
  if (slice && "expertAnalysis" in slice) {
    const expert = (slice as { expertAnalysis?: string }).expertAnalysis?.trim();
    if (expert) return expert;
  }
  if (slice && "qualitativeLabel" in slice) {
    const label = (slice as { qualitativeLabel?: string }).qualitativeLabel?.trim();
    if (label) return label;
  }
  const fromMotivations = pickMotivationText(
    slice && "motivations" in slice
      ? (slice as { motivations?: ScoreMotivation[] }).motivations
      : undefined,
  );
  if (fromMotivations) return fromMotivations;

  if (pillar.key === "empathy" && empathyNote?.trim()) return empathyNote.trim();
  if (pillar.key === "legalComplianceGelliBianco" && legalJustification?.trim()) {
    return legalJustification.trim();
  }
  return null;
}

function resolvePillarScore(radarData: RadarDatumWithKey[], pillar: (typeof PILLARS)[number]) {
  const byKey = radarData.find((d) => d.key === pillar.key);
  const raw = byKey?.score ?? radarData[pillar.fallbackIndex]?.score ?? 0;
  return clampPercentScore(raw);
}

function verdictForScore(score: number, dismissed?: boolean, killer?: boolean) {
  if (dismissed) {
    return {
      label: "Abbandonato",
      detail: "Sessione interrotta: valutazione non completata.",
      tone: "warn" as const,
      scoreClass: "text-[var(--aequan-status-warn)]",
      badgeClass: "bg-[var(--aequan-status-warn)] text-white",
      barClass: "bg-[var(--aequan-status-warn)]",
    };
  }
  if (killer || score < CLINICAL_PASS_TRENTESIMI) {
    return {
      label: "Non sufficiente",
      detail: "Sotto la soglia di idoneità clinica (18/30).",
      tone: "risk" as const,
      scoreClass: "text-[var(--aequan-status-risk)]",
      badgeClass: "bg-[var(--aequan-status-risk)] text-white",
      barClass: "bg-[var(--aequan-status-risk)]",
    };
  }
  if (score < 22) {
    return {
      label: "Sufficiente",
      detail: "Idoneità raggiunta, con margini di miglioramento.",
      tone: "ok" as const,
      scoreClass: "text-[var(--aequan-brand-primary)]",
      badgeClass: "bg-[var(--aequan-brand-primary)] text-white",
      barClass: "bg-[var(--aequan-brand-primary)]",
    };
  }
  if (score < 26) {
    return {
      label: "Buono",
      detail: "Gestione solida e allineata ai pilastri AEQUAN.",
      tone: "ok" as const,
      scoreClass: "text-[var(--aequan-brand-primary)]",
      badgeClass: "bg-[var(--aequan-brand-primary)] text-white",
      barClass: "bg-[var(--aequan-brand-secondary)]",
    };
  }
  return {
    label: "Ottimo",
    detail: "Prestazione di alto livello su clinica, tutela ed empatia.",
    tone: "ok" as const,
    scoreClass: "text-[var(--aequan-status-safe)]",
    badgeClass: "bg-[var(--aequan-status-safe)] text-white",
    barClass: "bg-[var(--aequan-status-safe)]",
  };
}

function pillarFlag(score: number) {
  if (score < 50) {
    return {
      label: "Critico",
      tone: "text-[var(--aequan-status-risk)]",
      badge: "border-[var(--aequan-status-risk)] bg-[var(--aequan-status-risk)] text-white",
    };
  }
  if (score < 70) {
    return {
      label: "Alterato",
      tone: "text-[var(--aequan-status-warn)]",
      badge: "border-[var(--aequan-status-warn)] bg-[var(--aequan-status-warn)] text-white",
    };
  }
  return {
    label: "Nei limiti",
    tone: "text-[var(--aequan-status-safe)]",
    badge: "border-[var(--aequan-status-safe)] bg-[var(--aequan-status-safe)] text-white",
  };
}

function legalShieldConfig(status: LegalProtectionStatus["status"]) {
  switch (status) {
    case "PROTECTED":
      return {
        label: "Protetto",
        icon: ShieldCheck,
        chip: "border-[var(--aequan-status-safe)] bg-[var(--aequan-status-safe)] text-white",
      };
    case "PARTIALLY_EXPOSED":
      return {
        label: "Parzialmente esposto",
        icon: Shield,
        chip: "border-[var(--aequan-status-warn)] bg-[var(--aequan-status-warn)] text-white",
      };
    default:
      return {
        label: "Esposto",
        icon: ShieldAlert,
        chip: "border-[var(--aequan-status-risk)] bg-[var(--aequan-status-risk)] text-white",
      };
  }
}

function Accordion({
  title,
  count,
  children,
  defaultOpen = true,
}: {
  title: string;
  count?: number;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <details
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      className="group bg-[var(--aequan-panel-bg)]"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 marker:content-none [&::-webkit-details-marker]:hidden sm:px-7">
        <span className="flex items-center gap-2.5">
          <span className="text-[13px] font-semibold text-[var(--aequan-brand-primary)]">{title}</span>
          {typeof count === "number" ? (
            <span className="border border-[var(--aequan-border)] bg-[var(--aequan-ui-bg)] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[var(--aequan-brand-primary)]">
              {count}
            </span>
          ) : null}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[var(--aequan-text-secondary)] transition duration-200 group-open:rotate-180" />
      </summary>
      <div className="border-t border-[var(--aequan-border)] px-5 py-4 sm:px-7">{children}</div>
    </details>
  );
}

function statusMeta(status: ClinicalDeltaRow["status"]) {
  switch (status) {
    case "MET":
      return {
        label: "Allineato",
        className:
          "border-[color-mix(in_srgb,var(--aequan-status-safe)_30%,white)] bg-[color-mix(in_srgb,var(--aequan-status-safe)_12%,white)] text-[var(--aequan-status-safe)]",
      };
    case "DELAYED":
      return {
        label: "Ritardato",
        className:
          "border-[color-mix(in_srgb,var(--aequan-status-warn)_35%,white)] bg-[color-mix(in_srgb,var(--aequan-status-warn)_10%,white)] text-[var(--aequan-status-warn)]",
      };
    default:
      return {
        label: "Mancato",
        className:
          "border-[color-mix(in_srgb,var(--aequan-status-risk)_35%,white)] bg-[color-mix(in_srgb,var(--aequan-status-risk)_10%,white)] text-[var(--aequan-status-risk)]",
      };
  }
}

export function EliteResultsClient({
  totalScore,
  radarData,
  caseTitle,
  sessionId,
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
  const shield = legalProtectionStatus
    ? legalShieldConfig(legalProtectionStatus.status)
    : null;
  const ShieldIcon = shield?.icon ?? Shield;

  const normalizedScore = safeDisplayTrentesimi(totalScore);
  const showKillerSwitchBanner =
    killerSwitch?.applied === true ||
    (!dismissed &&
      normalizedScore < CLINICAL_PASS_TRENTESIMI &&
      fatalErrors.length > 0);
  const killerCap = killerSwitch?.cap ?? 17.9;
  const verdict = verdictForScore(
    normalizedScore,
    dismissed,
    showKillerSwitchBanner || killerSwitch?.applied === true,
  );

  const wastedEuro = economicAnalysis
    ? economicAnalysis.unnecessaryExpenses.reduce((sum, item) => sum + (item.cost ?? 0), 0)
    : 0;
  const overspend =
    economicAnalysis && economicAnalysis.actualSpent > economicAnalysis.targetBudget
      ? economicAnalysis.actualSpent - economicAnalysis.targetBudget
      : 0;
  const budgetRatio =
    economicAnalysis && economicAnalysis.targetBudget > 0
      ? Math.min(100, (economicAnalysis.actualSpent / economicAnalysis.targetBudget) * 100)
      : 0;

  const empathyNote =
    empathyBreakdown?.qualitativeLabel ||
    scoreBreakdown?.empathy?.qualitativeLabel ||
    null;

  const dateLabel = new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date());
  const scoreDisplay = normalizedScore.toFixed(1).replace(".", ",");
  const barPct = Math.min(100, Math.max(0, (normalizedScore / 30) * 100));

  return (
    <div className="space-y-3">
      <article className="overflow-hidden border border-[var(--aequan-border)] bg-[var(--aequan-panel-bg)] shadow-[0_14px_40px_-20px_rgba(30,50,78,0.28)]">
        <header className="border-b-[6px] border-[var(--aequan-brand-primary)] bg-[var(--aequan-ui-bg)] px-5 py-4 sm:px-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--aequan-text-secondary)]">
                AEQUAN · Simulazione clinica
              </p>
              <h1 className="mt-1 font-display text-[1.65rem] font-semibold tracking-tight text-[var(--aequan-brand-primary)] sm:text-[1.85rem]">
                Referto di valutazione
              </h1>
            </div>
            <p className="text-right text-[11px] tabular-nums text-[var(--aequan-text-secondary)]">
              Emesso {dateLabel}
              {sessionId ? (
                <>
                  <br />
                  Sessione {sessionId.slice(0, 8).toUpperCase()}
                </>
              ) : null}
            </p>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-[var(--aequan-border)] pt-3 text-[12px] sm:grid-cols-4">
            <div>
              <dt className="text-[9px] font-bold uppercase tracking-wider text-[var(--aequan-text-secondary)]">Caso</dt>
              <dd className="mt-0.5 font-semibold leading-snug text-[var(--aequan-brand-primary)]">
                {caseTitle?.trim() || "Sessione valutata"}
              </dd>
            </div>
            <div>
              <dt className="text-[9px] font-bold uppercase tracking-wider text-[var(--aequan-text-secondary)]">Scala</dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-[var(--aequan-brand-primary)]">Trentesimi (0–30)</dd>
            </div>
            <div>
              <dt className="text-[9px] font-bold uppercase tracking-wider text-[var(--aequan-text-secondary)]">
                Soglia idoneità
              </dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-[var(--aequan-brand-primary)]">
                {CLINICAL_PASS_TRENTESIMI}/30
              </dd>
            </div>
            <div>
              <dt className="text-[9px] font-bold uppercase tracking-wider text-[var(--aequan-text-secondary)]">Esito</dt>
              <dd className={cn("mt-0.5 font-bold uppercase tracking-wide", verdict.scoreClass)}>
                {verdict.label}
              </dd>
            </div>
          </dl>
        </header>

        <section className="border-b border-[var(--aequan-border)] px-5 py-6 sm:px-7">
          <p className="text-center text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--aequan-text-secondary)]">
            Punteggio complessivo
          </p>
          <div className="mt-3 border border-[var(--aequan-border)] sm:hidden">
            <div className="bg-[var(--aequan-brand-primary)] px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-white">
              Voto finale
            </div>
            <div className="px-4 py-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <p
                  className={cn(
                    "font-display text-[2.75rem] font-semibold leading-none tabular-nums",
                    verdict.scoreClass,
                  )}
                >
                  {scoreDisplay}
                  <span className="ml-1 align-baseline text-lg font-medium text-[var(--aequan-text-secondary)]">/30</span>
                </p>
                <span
                  className={cn(
                    "inline-block border-2 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em]",
                    verdict.badgeClass,
                  )}
                >
                  {verdict.label}
                </span>
              </div>
              <p className="mt-3 text-xs leading-snug text-[var(--aequan-text-secondary)]">
                {verdict.detail} · Idoneità ≥ {CLINICAL_PASS_TRENTESIMI}/30
              </p>
            </div>
          </div>
          <div className="mt-3 hidden overflow-hidden border border-[var(--aequan-border)] sm:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--aequan-brand-primary)] text-[10px] font-bold uppercase tracking-wider text-white">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Indagine</th>
                  <th className="px-4 py-2.5 font-semibold">Risultato</th>
                  <th className="px-4 py-2.5 font-semibold">Valore di riferimento</th>
                  <th className="px-4 py-2.5 font-semibold">Valutazione</th>
                </tr>
              </thead>
              <tbody>
                <tr className="align-middle">
                  <td className="border-t border-[var(--aequan-border)] px-4 py-5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--aequan-text-secondary)]">
                      Performance clinica
                    </p>
                    <p className="mt-0.5 font-display text-lg font-semibold text-[var(--aequan-brand-primary)]">Voto finale</p>
                  </td>
                  <td className="border-t border-[var(--aequan-border)] px-4 py-5">
                    <p
                      className={cn(
                        "font-display text-5xl font-semibold leading-none tabular-nums",
                        verdict.scoreClass,
                      )}
                    >
                      {scoreDisplay}
                      <span className="ml-1 align-baseline text-lg font-medium text-[var(--aequan-text-secondary)]">/30</span>
                    </p>
                  </td>
                  <td className="border-t border-[var(--aequan-border)] px-4 py-5">
                    <p className="text-sm font-medium tabular-nums text-[var(--aequan-brand-primary)]">
                      Idoneità ≥ {CLINICAL_PASS_TRENTESIMI},00 / 30
                    </p>
                    <p className="mt-1 text-xs leading-snug text-[var(--aequan-text-secondary)]">{verdict.detail}</p>
                  </td>
                  <td className="border-t border-[var(--aequan-border)] px-4 py-5">
                    <span
                      className={cn(
                        "inline-block border-2 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em]",
                        verdict.badgeClass,
                      )}
                    >
                      {verdict.label}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-4 h-2.5 overflow-hidden bg-[var(--aequan-border)]">
            <div className={cn("h-full", verdict.barClass)} style={{ width: `${barPct}%` }} />
          </div>
          {dismissed ? (
            <p className="mt-3 inline-flex items-center gap-2 border border-[color-mix(in_srgb,var(--aequan-status-warn)_35%,white)] bg-[color-mix(in_srgb,var(--aequan-status-warn)_10%,white)] px-3 py-1.5 text-[11px] font-semibold text-[var(--aequan-status-warn)]">
              <AlertTriangle className="h-3.5 w-3.5" />
              Sessione abbandonata · punteggi azzerati su tutti gli assi
            </p>
          ) : null}
        </section>

        {showKillerSwitchBanner ? (
          <section className="border-b border-[color-mix(in_srgb,var(--aequan-status-risk)_35%,white)] bg-[color-mix(in_srgb,var(--aequan-status-risk)_10%,white)] px-5 py-4 sm:px-7">
            <div className="flex items-start gap-2.5">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--aequan-status-risk)]" />
              <div className="min-w-0 space-y-1.5">
                <p className="text-xs font-extrabold uppercase tracking-wider text-[var(--aequan-status-risk)]">
                  Valore critico · Bocciatura d&apos;ufficio · tetto {killerCap}/30
                </p>
                <p className="text-xs leading-relaxed text-[var(--aequan-status-risk)]">
                  Rilevati errori clinici o legali fatali.
                  {killerSwitch?.applied &&
                  typeof killerSwitch.rawTotalTrentesimi === "number" &&
                  typeof killerSwitch.finalTotalTrentesimi === "number"
                    ? ` Grezzo ${killerSwitch.rawTotalTrentesimi}/30 → finale ${killerSwitch.finalTotalTrentesimi}/30.`
                    : null}
                </p>
                {fatalErrors.length > 0 ? (
                  <ul className="space-y-1 pt-1">
                    {fatalErrors.map((error) => (
                      <li key={error.code} className="text-xs leading-relaxed text-[var(--aequan-status-risk)]">
                        · {error.description}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        <section className="border-b border-[var(--aequan-border)] px-5 py-6 sm:px-7">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--aequan-text-secondary)]">
            Cinque pilastri · contribuzione al voto
          </h2>
          <div className="mt-3 overflow-x-auto border border-[var(--aequan-border)]">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="bg-[var(--aequan-brand-primary)] text-[10px] font-bold uppercase tracking-wider text-white">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Pilastro</th>
                  <th className="px-3 py-2.5 font-semibold">Risultato</th>
                  <th className="px-3 py-2.5 font-semibold">Contributo</th>
                  <th className="px-3 py-2.5 font-semibold">Riferimento</th>
                  <th className="px-3 py-2.5 font-semibold">Esito</th>
                </tr>
              </thead>
              <tbody>
                {PILLARS.map((pillar, i) => {
                  const score = resolvePillarScore(radarData, pillar);
                  const maxPts =
                    pillar.gradeWeight != null
                      ? Math.round(pillar.gradeWeight * 30)
                      : null;
                  const contribution =
                    pillar.gradeWeight != null
                      ? dimensionContributionTrentesimi(score, pillar.gradeWeight)
                      : null;
                  const insight = resolvePillarInsight(
                    pillar,
                    coachingFeedback,
                    scoreBreakdown,
                    empathyNote,
                    legalProtectionStatus?.justification,
                  );
                  const flag = pillarFlag(score);
                  const Icon = pillar.icon;
                  return (
                    <tr key={pillar.key} className={i % 2 === 0 ? "bg-[var(--aequan-panel-bg)]" : "bg-[var(--aequan-border-subtle)]"}>
                      <td className="border-t border-[var(--aequan-border)] px-3 py-3 align-top">
                        <p className="flex items-center gap-2 font-semibold text-[var(--aequan-brand-primary)]">
                          <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--aequan-text-secondary)]" strokeWidth={1.75} />
                          {pillar.label}
                        </p>
                        {insight ? (
                          <p className="mt-1 max-w-sm text-[12px] leading-snug text-[var(--aequan-text-secondary)]">
                            <SafeLlmText as="span" className="whitespace-pre-line">
                              {insight}
                            </SafeLlmText>
                          </p>
                        ) : null}
                      </td>
                      <td
                        className={cn(
                          "border-t border-[var(--aequan-border)] px-3 py-3 align-top font-display text-2xl font-semibold tabular-nums",
                          flag.tone,
                        )}
                      >
                        {Math.round(score)}
                        <span className="ml-0.5 text-sm font-medium text-[var(--aequan-text-secondary)]">/100</span>
                      </td>
                      <td className="border-t border-[var(--aequan-border)] px-3 py-3 align-top text-[13px] tabular-nums text-[var(--aequan-brand-primary)]">
                        {contribution != null && maxPts != null
                          ? `${String(contribution).replace(".", ",")}/${maxPts}`
                          : "solo radar"}
                      </td>
                      <td className="border-t border-[var(--aequan-border)] px-3 py-3 align-top text-[12px] text-[var(--aequan-text-secondary)]">
                        {pillar.gradeWeight != null ? "≥ 70/100 nei limiti" : "Indicatore accessorio"}
                      </td>
                      <td className="border-t border-[var(--aequan-border)] px-3 py-3 align-top">
                        <span
                          className={cn(
                            "inline-block border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider",
                            flag.badge,
                          )}
                        >
                          {flag.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="border-b border-[var(--aequan-border)] px-5 py-6 sm:px-7">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--aequan-text-secondary)]">
            Indicatori accessori
          </h2>
          <div className="mt-3 overflow-hidden border border-[var(--aequan-border)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--aequan-ui-bg)] text-[10px] font-bold uppercase tracking-wider text-[var(--aequan-text-secondary)]">
                <tr>
                  <th className="px-4 py-2 font-semibold">Indicatore</th>
                  <th className="px-4 py-2 font-semibold">Risultato</th>
                  <th className="px-4 py-2 font-semibold">Note</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border-t border-[var(--aequan-border)] px-4 py-3 font-semibold text-[var(--aequan-brand-primary)]">
                    Bilancio SSN
                  </td>
                  <td className="border-t border-[var(--aequan-border)] px-4 py-3">
                    {economicAnalysis ? (
                      <>
                        <p
                          className={cn(
                            "font-display text-2xl font-semibold tabular-nums",
                            overspend > 0 ? "text-[var(--aequan-status-risk)]" : "text-[var(--aequan-brand-primary)]",
                          )}
                        >
                          €{economicAnalysis.actualSpent.toFixed(0)}
                          <span className="ml-1 text-sm font-medium text-[var(--aequan-text-secondary)]">
                            / €{economicAnalysis.targetBudget.toFixed(0)}
                          </span>
                        </p>
                        <div className="mt-2 h-1.5 overflow-hidden bg-[var(--aequan-border)]">
                          <div
                            className={cn("h-full", overspend > 0 ? "bg-[var(--aequan-status-risk)]" : "bg-[var(--aequan-brand-primary)]")}
                            style={{ width: `${budgetRatio}%` }}
                          />
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-[var(--aequan-text-secondary)]">Non disponibile</span>
                    )}
                  </td>
                  <td className="border-t border-[var(--aequan-border)] px-4 py-3 text-[13px] leading-snug text-[var(--aequan-text-secondary)]">
                    {economicAnalysis
                      ? `${overspend > 0 ? `Sforamento +€${overspend.toFixed(0)}` : "Budget entro soglia di appropriatezza"}${
                          wastedEuro > 0 ? ` · sprechi €${wastedEuro.toFixed(0)}` : ""
                        }`
                      : "Bilancio non calcolato per questa sessione."}
                  </td>
                </tr>
                <tr>
                  <td className="border-t border-[var(--aequan-border)] px-4 py-3 font-semibold text-[var(--aequan-brand-primary)]">
                    Scudo legale
                  </td>
                  <td className="border-t border-[var(--aequan-border)] px-4 py-3">
                    {legalProtectionStatus && shield ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 border px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider",
                          shield.chip,
                        )}
                      >
                        <ShieldIcon className="h-3.5 w-3.5" strokeWidth={1.75} />
                        {shield.label}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--aequan-text-secondary)]">Non disponibile</span>
                    )}
                  </td>
                  <td className="border-t border-[var(--aequan-border)] px-4 py-3 text-[13px] leading-snug text-[var(--aequan-text-secondary)]">
                    {legalProtectionStatus ? (
                      <>
                        <SafeLlmText as="span" className="whitespace-pre-line">
                          {legalProtectionStatus.justification}
                        </SafeLlmText>
                        {legalSources.length > 0 ? (
                          <p className="mt-1 text-[11px] text-[var(--aequan-text-secondary)]">
                            Fonti · {legalSources.join(" · ")}
                          </p>
                        ) : null}
                      </>
                    ) : (
                      "Stato tutela non disponibile."
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <div className="border-b border-[var(--aequan-border)] bg-[var(--aequan-ui-bg)] px-5 py-3 sm:px-7">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--aequan-text-secondary)]">
              Debrief clinico
            </p>
          </div>
          <div className="divide-y divide-[var(--aequan-border)]">
            {clinicalDeltaTable.length > 0 ? (
              <Accordion title="Confronto Gold Standard" count={clinicalDeltaTable.length} defaultOpen>
                <ul className="space-y-2.5">
                  {clinicalDeltaTable.map((row, idx) => {
                    const meta = statusMeta(row.status);
                    return (
                      <li
                        key={`${row.protocolAction}-${idx}`}
                        className="border border-[var(--aequan-border)] bg-[var(--aequan-border-subtle)] px-3.5 py-3"
                      >
                        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[13px] font-semibold text-[var(--aequan-brand-primary)]">{row.protocolAction}</p>
                          <span
                            className={cn(
                              "border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider",
                              meta.className,
                            )}
                          >
                            {meta.label}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed text-[var(--aequan-text-secondary)]">
                          <SafeLlmText as="span">{row.userAction}</SafeLlmText>
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </Accordion>
            ) : null}

            {economicAnalysis &&
            (economicAnalysis.unnecessaryExpenses.length > 0 ||
              economicAnalysis.missedRequiredExams.length > 0) ? (
              <Accordion
                title="Spese e omissioni"
                count={
                  economicAnalysis.unnecessaryExpenses.length +
                  economicAnalysis.missedRequiredExams.length
                }
                defaultOpen
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--aequan-status-risk)]">
                      Superflue
                    </p>
                    {economicAnalysis.unnecessaryExpenses.length === 0 ? (
                      <p className="text-xs text-[var(--aequan-text-secondary)]">Nessuna.</p>
                    ) : (
                      economicAnalysis.unnecessaryExpenses.map((item, i) => (
                        <div key={i} className="border border-[color-mix(in_srgb,var(--aequan-status-risk)_30%,white)] bg-[color-mix(in_srgb,var(--aequan-status-risk)_10%,white)] px-3 py-2.5">
                          <div className="flex justify-between gap-2 text-[13px]">
                            <span className="font-medium text-[var(--aequan-brand-primary)]">{item.examName}</span>
                            <span className="font-semibold tabular-nums text-[var(--aequan-status-risk)]">
                              €{item.cost.toFixed(0)}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] leading-relaxed text-[var(--aequan-text-secondary)]">{item.reason}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--aequan-status-warn)]">
                      Mancati
                    </p>
                    {economicAnalysis.missedRequiredExams.length === 0 ? (
                      <p className="text-xs text-[var(--aequan-text-secondary)]">Nessuno.</p>
                    ) : (
                      economicAnalysis.missedRequiredExams.map((item, i) => (
                        <div key={i} className="border border-[color-mix(in_srgb,var(--aequan-status-warn)_35%,white)] bg-[color-mix(in_srgb,var(--aequan-status-warn)_10%,white)] px-3 py-2.5">
                          <div className="flex justify-between gap-2 text-[13px]">
                            <span className="font-medium text-[var(--aequan-brand-primary)]">{item.examName}</span>
                            <span className="font-semibold tabular-nums text-[var(--aequan-status-warn)]">
                              €{item.cost.toFixed(0)}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] leading-relaxed text-[var(--aequan-text-secondary)]">{item.reason}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </Accordion>
            ) : null}

            {coachingFeedback ? (
              <Accordion title="Coaching clinico" defaultOpen>
                <dl className="space-y-3">
                  {COACH_ROWS.map(({ key, label }) => {
                    const text = coachingFeedback[key];
                    if (!text?.trim()) return null;
                    return (
                      <div
                        key={key}
                        className="border border-[var(--aequan-border)] bg-[var(--aequan-border-subtle)] px-3.5 py-3 sm:grid sm:grid-cols-[6rem_1fr] sm:gap-3"
                      >
                        <dt className="text-[11px] font-bold uppercase tracking-wide text-[var(--aequan-brand-primary)]">
                          {label}
                        </dt>
                        <dd className="mt-1 text-sm leading-relaxed text-[var(--aequan-text-primary)] sm:mt-0">
                          <SafeLlmText as="span" className="whitespace-pre-line">
                            {text}
                          </SafeLlmText>
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </Accordion>
            ) : null}

            {strengths.length > 0 || weaknesses.length > 0 ? (
              <Accordion
                title="Forze e miglioramenti"
                count={strengths.length + weaknesses.length}
                defaultOpen
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="border border-[var(--aequan-border)] bg-[color-mix(in_srgb,var(--aequan-brand-secondary)_12%,white)] p-3.5">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--aequan-brand-primary)]">
                      Forze
                    </p>
                    {strengths.length === 0 ? (
                      <p className="text-xs text-[var(--aequan-text-secondary)]">Nessun punto evidenziato.</p>
                    ) : (
                      <ul className="space-y-2">
                        {strengths.map((item, idx) => (
                          <li key={idx} className="text-sm leading-relaxed text-[var(--aequan-text-primary)]">
                            <SafeLlmText as="span">{item}</SafeLlmText>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="border border-[color-mix(in_srgb,var(--aequan-status-warn)_35%,white)] bg-[color-mix(in_srgb,var(--aequan-status-warn)_10%,white)] p-3.5">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--aequan-status-warn)]">
                      Miglioramenti
                    </p>
                    {weaknesses.length === 0 ? (
                      <p className="text-xs text-[var(--aequan-text-secondary)]">Nessuna criticità evidenziata.</p>
                    ) : (
                      <ul className="space-y-2">
                        {weaknesses.map((item, idx) => (
                          <li key={idx} className="text-sm leading-relaxed text-[var(--aequan-text-primary)]">
                            <SafeLlmText as="span">{item}</SafeLlmText>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </Accordion>
            ) : null}

            {correctSolution ? (
              <Accordion title="Gestione esperta di riferimento" defaultOpen>
                <p className="text-sm leading-relaxed text-[var(--aequan-text-primary)]">
                  <SafeLlmText as="span" className="whitespace-pre-line">
                    {correctSolution}
                  </SafeLlmText>
                </p>
              </Accordion>
            ) : null}

            <div>
              <div className="border-b border-[var(--aequan-border)] px-5 py-3.5 sm:px-7">
                <h2 className="text-[13px] font-semibold text-[var(--aequan-brand-primary)]">Radar competenze</h2>
              </div>
              <div className="h-72 w-full bg-[var(--aequan-border-subtle)] p-3 sm:p-4">
                <ResultsRadarClient data={radarData} />
              </div>
            </div>
          </div>
          <footer className="border-t-4 border-[var(--aequan-brand-primary)] bg-[var(--aequan-ui-bg)] px-5 py-3 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--aequan-text-secondary)] sm:px-7">
            Fine referto
          </footer>
        </section>
      </article>

      <AiTransparencyBadge
        variant="report"
        className="border border-[var(--aequan-border)] bg-[var(--aequan-panel-bg)] px-3.5 py-2 text-[11px] text-[var(--aequan-text-secondary)]"
      />
    </div>
  );
}
