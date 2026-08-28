"use client";

import type { ReactNode } from "react";
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
}> = [
  {
    key: "clinicalAccuracy",
    label: "Clinica",
    icon: Stethoscope,
    fallbackIndex: 0,
    gradeWeight: MACRO_AREA_WEIGHTS.clinicalDiagnostic,
  },
  {
    key: "legalComplianceGelliBianco",
    label: "Tutela",
    icon: Scale,
    fallbackIndex: 1,
    gradeWeight: MACRO_AREA_WEIGHTS.legalCompliance,
  },
  {
    key: "prescribingAppropriateness",
    label: "Esami",
    icon: Activity,
    fallbackIndex: 2,
    gradeWeight: MACRO_AREA_WEIGHTS.examAppropriateness,
  },
  {
    key: "economicSustainability",
    label: "Economia",
    icon: Euro,
    fallbackIndex: 3,
    gradeWeight: null,
  },
  {
    key: "empathy",
    label: "Empatia",
    icon: HeartHandshake,
    fallbackIndex: 4,
    gradeWeight: MACRO_AREA_WEIGHTS.empathy,
  },
];

const COACH_ROWS: Array<{ key: keyof CoachingFeedback; label: string }> = [
  { key: "accuratezza", label: "Clinica" },
  { key: "tutelaLegale", label: "Tutela" },
  { key: "economicita", label: "Economia" },
  { key: "empatia", label: "Empatia" },
];

function resolvePillarScore(radarData: RadarDatumWithKey[], pillar: (typeof PILLARS)[number]) {
  const byKey = radarData.find((d) => d.key === pillar.key);
  const raw = byKey?.score ?? radarData[pillar.fallbackIndex]?.score ?? 0;
  return clampPercentScore(raw);
}

function verdictForScore(score: number, dismissed?: boolean, killer?: boolean) {
  if (dismissed) {
    return {
      label: "Caso abbandonato",
      detail: "La sessione è stata interrotta senza completare la valutazione.",
      tone: "warn" as const,
    };
  }
  if (killer || score < CLINICAL_PASS_TRENTESIMI) {
    return {
      label: "Non sufficiente",
      detail: "Il percorso non raggiunge la soglia di idoneità clinica.",
      tone: "risk" as const,
    };
  }
  if (score < 22) {
    return {
      label: "Sufficiente",
      detail: "Idoneità raggiunta, con margini di miglioramento.",
      tone: "ok" as const,
    };
  }
  if (score < 26) {
    return {
      label: "Buono",
      detail: "Gestione solida e allineata ai pilastri AEQUAN.",
      tone: "ok" as const,
    };
  }
  return {
    label: "Ottimo",
    detail: "Prestazione di alto livello su clinica, tutela ed empatia.",
    tone: "ok" as const,
  };
}

function legalShieldConfig(status: LegalProtectionStatus["status"]) {
  switch (status) {
    case "PROTECTED":
      return {
        label: "Protetto",
        icon: ShieldCheck,
        chip: "bg-[#E4EAF3] text-[#1E324E]",
      };
    case "PARTIALLY_EXPOSED":
      return {
        label: "Parzialmente esposto",
        icon: Shield,
        chip: "bg-amber-100 text-amber-950",
      };
    default:
      return {
        label: "Esposto",
        icon: ShieldAlert,
        chip: "bg-rose-100 text-rose-900",
      };
  }
}

function ScoreRing({ score, max = 30 }: { score: number; max?: number }) {
  const clamped = Math.max(0, Math.min(max, score));
  const pct = max > 0 ? clamped / max : 0;
  const r = 54;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);

  return (
    <div className="relative h-[8.5rem] w-[8.5rem] shrink-0">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 128 128" aria-hidden>
        <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="8" />
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke="#A8C0DE"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-display text-[2.35rem] font-semibold leading-none tabular-nums text-white">
          {Math.round(clamped * 10) / 10}
        </span>
        <span className="mt-1 text-[11px] font-medium tracking-wide text-white/55">/{max}</span>
      </div>
    </div>
  );
}

function Accordion({
  title,
  count,
  children,
  defaultOpen = false,
}: {
  title: string;
  count?: number;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen || undefined}
      className="group overflow-hidden rounded-2xl border border-slate-200/90 bg-white"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 marker:content-none [&::-webkit-details-marker]:hidden sm:px-5">
        <span className="flex items-center gap-2.5">
          <span className="font-display text-sm font-semibold text-[#1E324E]">{title}</span>
          {typeof count === "number" ? (
            <span className="rounded-full bg-[#EEF2F9] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-[#345884]">
              {count}
            </span>
          ) : null}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition duration-200 group-open:rotate-180" />
      </summary>
      <div className="border-t border-slate-100 px-4 py-4 sm:px-5">{children}</div>
    </details>
  );
}

function statusMeta(status: ClinicalDeltaRow["status"]) {
  switch (status) {
    case "MET":
      return { label: "Allineato", className: "bg-emerald-50 text-emerald-800" };
    case "DELAYED":
      return { label: "Ritardato", className: "bg-amber-50 text-amber-900" };
    default:
      return { label: "Mancato", className: "bg-rose-50 text-rose-800" };
  }
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

  return (
    <div className="space-y-5">
      {/* Verdict board */}
      <section
        className={cn(
          "relative overflow-hidden rounded-[1.35rem] text-white shadow-[0_20px_50px_-28px_rgba(30,50,78,0.65)]",
          "bg-[linear-gradient(145deg,#1E324E_0%,#2A486D_48%,#345884_100%)]",
        )}
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_85%_20%,rgba(168,192,222,0.22),transparent_42%)]"
          aria-hidden
        />
        <div className="relative flex flex-col gap-6 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div className="min-w-0 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] !text-white/70">
              Aequan · Verdetto
            </p>
            <div className="space-y-1.5">
              <h1 className="font-display text-[1.85rem] font-semibold tracking-tight !text-white sm:text-[2.1rem]">
                {verdict.label}
              </h1>
              <p className="max-w-md text-sm leading-relaxed !text-white/75">{verdict.detail}</p>
            </div>
            {dismissed ? (
              <p className="inline-flex items-center gap-2 rounded-full bg-amber-400/15 px-3 py-1.5 text-[11px] font-medium text-amber-100 ring-1 ring-amber-200/25">
                <AlertTriangle className="h-3.5 w-3.5" />
                Punteggi azzerati su tutti gli assi
              </p>
            ) : null}
          </div>
          <ScoreRing score={normalizedScore} />
        </div>

        {showKillerSwitchBanner ? (
          <div className="relative border-t border-white/10 bg-black/20 px-5 py-3.5 sm:px-7">
            <div className="flex items-start gap-2.5">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
              <div className="min-w-0 space-y-1.5">
                <p className="text-xs font-semibold text-rose-100">
                  Bocciatura d&apos;ufficio · tetto {killerCap}/30
                </p>
                <p className="text-xs leading-relaxed text-white/70">
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
                      <li key={error.code} className="text-xs leading-relaxed text-white/65">
                        · {error.description}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <AiTransparencyBadge
        variant="report"
        className="rounded-xl border-slate-200/80 bg-white/70 px-3.5 py-2 text-[11px] text-slate-500"
      />

      {/* Pillars grid */}
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3 px-0.5">
          <div>
            <h2 className="font-display text-base font-semibold text-[#1E324E]">I cinque pilastri</h2>
            <p className="mt-0.5 text-xs text-slate-500">Pesi sul voto: 30 · 30 · 20 · 20</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {PILLARS.map((pillar) => {
            const score = resolvePillarScore(radarData, pillar);
            const contribution =
              pillar.gradeWeight != null
                ? dimensionContributionTrentesimi(score, pillar.gradeWeight)
                : null;
            const Icon = pillar.icon;
            return (
              <article
                key={pillar.key}
                className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-[0_1px_0_rgba(30,50,78,0.04)]"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#EEF2F9] text-[#345884]">
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <span className="text-right">
                    <span className="block font-display text-lg font-semibold tabular-nums leading-none text-[#1E324E]">
                      {Math.round(score)}
                    </span>
                    <span className="text-[10px] text-slate-400">/100</span>
                  </span>
                </div>
                <p className="text-[13px] font-semibold text-slate-800">{pillar.label}</p>
                <p className="mt-0.5 text-[10px] tabular-nums text-slate-400">
                  {contribution != null ? `${contribution}/30` : "solo radar"}
                </p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[#345884] transition-[width] duration-700 ease-out"
                    style={{ width: `${score}%` }}
                    role="progressbar"
                    aria-valuenow={Math.round(score)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${pillar.label}: ${Math.round(score)} su 100`}
                  />
                </div>
              </article>
            );
          })}
        </div>
        {empathyNote ? (
          <p className="rounded-xl bg-[#EEF2F9]/80 px-3.5 py-2.5 text-xs leading-relaxed text-[#1E324E]/80">
            <span className="font-semibold text-[#345884]">Empatia · </span>
            {empathyNote}
          </p>
        ) : null}
      </section>

      {/* Economy + Legal */}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_0_rgba(30,50,78,0.04)] sm:p-5">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EEF2F9] text-[#345884]">
              <Euro className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div>
              <h2 className="font-display text-sm font-semibold text-[#1E324E]">Bilancio SSN</h2>
              <p className="text-[11px] text-slate-500">Spesa esami vs budget del caso</p>
            </div>
          </div>
          {economicAnalysis ? (
            <div className="space-y-3">
              <p className="font-display text-2xl font-semibold tabular-nums text-[#1E324E]">
                €{economicAnalysis.actualSpent.toFixed(0)}
                <span className="ml-1 text-sm font-medium text-slate-400">
                  / €{economicAnalysis.targetBudget.toFixed(0)}
                </span>
              </p>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-700",
                    overspend > 0 ? "bg-[#C0392B]" : "bg-[#345884]",
                  )}
                  style={{ width: `${budgetRatio}%` }}
                />
              </div>
              <p className="text-xs text-slate-500">
                {overspend > 0
                  ? `Sforamento +€${overspend.toFixed(0)}`
                  : "Budget entro soglia di appropriatezza"}
                {wastedEuro > 0 ? ` · sprechi €${wastedEuro.toFixed(0)}` : null}
              </p>
            </div>
          ) : (
            <div className="rounded-xl bg-slate-50 px-3.5 py-6 text-center text-xs text-slate-500">
              Bilancio non disponibile per questa sessione.
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_0_rgba(30,50,78,0.04)] sm:p-5">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EEF2F9] text-[#345884]">
              <Shield className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div>
              <h2 className="font-display text-sm font-semibold text-[#1E324E]">Scudo legale</h2>
              <p className="text-[11px] text-slate-500">Tutela medico-legale della condotta</p>
            </div>
          </div>
          {legalProtectionStatus && shield ? (
            <div className="space-y-3">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                  shield.chip,
                )}
              >
                <ShieldIcon className="h-3.5 w-3.5" strokeWidth={1.75} />
                {shield.label}
              </span>
              <p className="text-sm leading-relaxed text-slate-600">
                <SafeLlmText as="span" className="whitespace-pre-line">
                  {legalProtectionStatus.justification}
                </SafeLlmText>
              </p>
              {legalSources.length > 0 ? (
                <p className="text-[11px] text-slate-400">Fonti · {legalSources.join(" · ")}</p>
              ) : null}
            </div>
          ) : (
            <div className="rounded-xl bg-slate-50 px-3.5 py-6 text-center text-xs text-slate-500">
              Stato tutela non disponibile.
            </div>
          )}
        </article>
      </section>

      {/* Debrief */}
      <section className="space-y-2.5">
        <h2 className="px-0.5 font-display text-base font-semibold text-[#1E324E]">Debrief</h2>

        {clinicalDeltaTable.length > 0 ? (
          <Accordion title="Confronto Gold Standard" count={clinicalDeltaTable.length}>
            <ul className="space-y-2.5">
              {clinicalDeltaTable.map((row, idx) => {
                const meta = statusMeta(row.status);
                return (
                  <li
                    key={`${row.protocolAction}-${idx}`}
                    className="rounded-xl bg-slate-50/90 px-3.5 py-3"
                  >
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold text-slate-800">{row.protocolAction}</p>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          meta.className,
                        )}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-500">
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
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">
                  Superflue
                </p>
                {economicAnalysis.unnecessaryExpenses.length === 0 ? (
                  <p className="text-xs text-slate-500">Nessuna.</p>
                ) : (
                  economicAnalysis.unnecessaryExpenses.map((item, i) => (
                    <div key={i} className="rounded-xl bg-rose-50/60 px-3 py-2.5">
                      <div className="flex justify-between gap-2 text-[13px]">
                        <span className="font-medium text-slate-800">{item.examName}</span>
                        <span className="font-semibold tabular-nums text-rose-700">
                          €{item.cost.toFixed(0)}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{item.reason}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                  Mancati
                </p>
                {economicAnalysis.missedRequiredExams.length === 0 ? (
                  <p className="text-xs text-slate-500">Nessuno.</p>
                ) : (
                  economicAnalysis.missedRequiredExams.map((item, i) => (
                    <div key={i} className="rounded-xl bg-amber-50/70 px-3 py-2.5">
                      <div className="flex justify-between gap-2 text-[13px]">
                        <span className="font-medium text-slate-800">{item.examName}</span>
                        <span className="font-semibold tabular-nums text-amber-800">
                          €{item.cost.toFixed(0)}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{item.reason}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Accordion>
        ) : null}

        {coachingFeedback ? (
          <Accordion title="Coaching clinico">
            <dl className="space-y-3">
              {COACH_ROWS.map(({ key, label }) => {
                const text = coachingFeedback[key];
                if (!text?.trim()) return null;
                return (
                  <div
                    key={key}
                    className="rounded-xl bg-slate-50/90 px-3.5 py-3 sm:grid sm:grid-cols-[6rem_1fr] sm:gap-3"
                  >
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#345884]">
                      {label}
                    </dt>
                    <dd className="mt-1 text-sm leading-relaxed text-slate-600 sm:mt-0">
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

        {(strengths.length > 0 || weaknesses.length > 0) && (
          <Accordion
            title="Forze e miglioramenti"
            count={strengths.length + weaknesses.length}
            defaultOpen
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-[#EEF2F9]/70 p-3.5">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#345884]">
                  Forze
                </p>
                {strengths.length === 0 ? (
                  <p className="text-xs text-slate-500">Nessun punto evidenziato.</p>
                ) : (
                  <ul className="space-y-2">
                    {strengths.map((item, idx) => (
                      <li key={idx} className="text-sm leading-relaxed text-slate-700">
                        <SafeLlmText as="span">{item}</SafeLlmText>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-xl bg-amber-50/80 p-3.5">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-amber-900">
                  Miglioramenti
                </p>
                {weaknesses.length === 0 ? (
                  <p className="text-xs text-slate-500">Nessuna criticità evidenziata.</p>
                ) : (
                  <ul className="space-y-2">
                    {weaknesses.map((item, idx) => (
                      <li key={idx} className="text-sm leading-relaxed text-slate-700">
                        <SafeLlmText as="span">{item}</SafeLlmText>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Accordion>
        )}

        {correctSolution ? (
          <Accordion title="Gestione esperta di riferimento">
            <p className="text-sm leading-relaxed text-slate-600">
              <SafeLlmText as="span" className="whitespace-pre-line">
                {correctSolution}
              </SafeLlmText>
            </p>
          </Accordion>
        ) : null}

        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white">
          <div className="border-b border-slate-100 px-4 py-3.5 sm:px-5">
            <h2 className="font-display text-sm font-semibold text-[#1E324E]">Radar competenze</h2>
          </div>
          <div className="h-72 w-full bg-slate-50/80 p-3 sm:p-4">
            <ResultsRadarClient data={radarData} />
          </div>
        </div>
      </section>
    </div>
  );
}
