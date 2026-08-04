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
  short: string;
  icon: LucideIcon;
  fallbackIndex: number;
  gradeWeight: number | null;
}> = [
  {
    key: "clinicalAccuracy",
    label: "Accuratezza clinica",
    short: "Clinica",
    icon: Stethoscope,
    fallbackIndex: 0,
    gradeWeight: MACRO_AREA_WEIGHTS.clinicalDiagnostic,
  },
  {
    key: "legalComplianceGelliBianco",
    label: "Tutela medico-legale",
    short: "Tutela",
    icon: Scale,
    fallbackIndex: 1,
    gradeWeight: MACRO_AREA_WEIGHTS.legalCompliance,
  },
  {
    key: "prescribingAppropriateness",
    label: "Appropriatezza esami",
    short: "Esami",
    icon: Activity,
    fallbackIndex: 2,
    gradeWeight: MACRO_AREA_WEIGHTS.examAppropriateness,
  },
  {
    key: "economicSustainability",
    label: "Sostenibilità economica",
    short: "Economia",
    icon: Euro,
    fallbackIndex: 3,
    gradeWeight: null,
  },
  {
    key: "empathy",
    label: "Empatia",
    short: "Empatia",
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

function legalShieldConfig(status: LegalProtectionStatus["status"]) {
  switch (status) {
    case "PROTECTED":
      return {
        label: "Protetto",
        icon: ShieldCheck,
        tone: "text-[#345884] bg-[#E4EAF3] border-[#345884]/20",
      };
    case "PARTIALLY_EXPOSED":
      return {
        label: "Parzialmente esposto",
        icon: Shield,
        tone: "text-amber-900 bg-amber-50 border-amber-200/80",
      };
    default:
      return {
        label: "Esposto",
        icon: ShieldAlert,
        tone: "text-rose-800 bg-rose-50 border-rose-200/80",
      };
  }
}

function resolvePillarScore(radarData: RadarDatumWithKey[], pillar: (typeof PILLARS)[number]) {
  const byKey = radarData.find((d) => d.key === pillar.key);
  const raw = byKey?.score ?? radarData[pillar.fallbackIndex]?.score ?? 0;
  return clampPercentScore(raw);
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
      className="group border-b border-slate-200/80 last:border-b-0"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3.5 text-sm font-medium text-slate-800 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          {title}
          {typeof count === "number" ? (
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-500">
              {count}
            </span>
          ) : null}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-180" />
      </summary>
      <div className="pb-4 pt-0.5">{children}</div>
    </details>
  );
}

function statusMeta(status: ClinicalDeltaRow["status"]) {
  switch (status) {
    case "MET":
      return "text-emerald-700";
    case "DELAYED":
      return "text-amber-700";
    default:
      return "text-rose-700";
  }
}

function statusLabel(status: ClinicalDeltaRow["status"]) {
  switch (status) {
    case "MET":
      return "Allineato";
    case "DELAYED":
      return "Ritardato";
    default:
      return "Mancato";
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
    (normalizedScore < CLINICAL_PASS_TRENTESIMI && fatalErrors.length > 0);
  const killerCap = killerSwitch?.cap ?? 17.9;

  const wastedEuro = economicAnalysis
    ? economicAnalysis.unnecessaryExpenses.reduce((sum, item) => sum + (item.cost ?? 0), 0)
    : 0;
  const overspend =
    economicAnalysis && economicAnalysis.actualSpent > economicAnalysis.targetBudget
      ? economicAnalysis.actualSpent - economicAnalysis.targetBudget
      : 0;
  const budgetRatio =
    economicAnalysis && economicAnalysis.targetBudget > 0
      ? Math.min(150, (economicAnalysis.actualSpent / economicAnalysis.targetBudget) * 100)
      : 0;

  const empathyNote =
    empathyBreakdown?.qualitativeLabel ||
    scoreBreakdown?.empathy?.qualitativeLabel ||
    null;

  return (
    <div className="space-y-5 text-slate-800">
      <AiTransparencyBadge
        variant="report"
        className="rounded-none border-0 border-b border-slate-200/80 bg-transparent px-0 py-0 text-[11px] text-slate-500"
      />

      {dismissed ? (
        <div
          role="status"
          className="flex items-start gap-2.5 border-l-2 border-amber-500 bg-amber-50/70 px-3 py-2.5"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden />
          <p className="text-xs leading-relaxed text-amber-950">
            Caso abbandonato: punteggi registrati a 0 su tutti gli assi.
          </p>
        </div>
      ) : null}

      {/* Hero — score + title as one strip, no nested score card */}
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#345884]">
            Report di valutazione
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-[#1E324E] sm:text-[1.7rem]">
            Esito simulazione
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-slate-500">
            Quattro dimensioni pesano sul /30. Economia e radar restano analitici.
          </p>
        </div>
        <div className="shrink-0 sm:text-right">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">
            Score
          </p>
          <p className="font-display text-[2.75rem] font-semibold leading-none tabular-nums tracking-tight text-[#1E324E]">
            {Math.round(normalizedScore * 10) / 10}
            <span className="ml-1 text-base font-medium text-slate-400">/30</span>
          </p>
        </div>
      </header>

      {showKillerSwitchBanner ? (
        <div
          role="alert"
          className="space-y-2 border-l-2 border-rose-600 bg-rose-50/80 px-3 py-2.5"
        >
          <p className="text-xs font-semibold text-rose-900">
            Bocciatura d&apos;ufficio · tetto {killerCap}/30
          </p>
          <p className="text-xs leading-relaxed text-rose-900/85">
            Rilevati errori clinici o legali fatali.
            {killerSwitch?.applied &&
            typeof killerSwitch.rawTotalTrentesimi === "number" &&
            typeof killerSwitch.finalTotalTrentesimi === "number"
              ? ` Grezzo ${killerSwitch.rawTotalTrentesimi}/30 → finale ${killerSwitch.finalTotalTrentesimi}/30.`
              : null}
          </p>
          {fatalErrors.length > 0 ? (
            <ul className="space-y-1 text-xs leading-relaxed text-rose-900/80">
              {fatalErrors.map((error) => (
                <li key={error.code} className="flex gap-2">
                  <XCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                  <span>{error.description}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {/* Pillars — bars only */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-[#1E324E]">Pilastri</h2>
          <p className="text-[11px] text-slate-400">pesi 30 · 30 · 20 · 20</p>
        </div>
        <div className="space-y-3">
          {PILLARS.map((pillar) => {
            const score = resolvePillarScore(radarData, pillar);
            const contribution =
              pillar.gradeWeight != null
                ? dimensionContributionTrentesimi(score, pillar.gradeWeight)
                : null;
            const Icon = pillar.icon;
            return (
              <div key={pillar.key} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <Icon className="h-3.5 w-3.5 shrink-0 text-[#345884]" strokeWidth={1.75} />
                    <span className="truncate text-[13px] font-medium text-slate-700">
                      {pillar.label}
                    </span>
                  </div>
                  <span className="shrink-0 text-[12px] font-semibold tabular-nums text-slate-700">
                    {Math.round(score)}
                    <span className="font-normal text-slate-400">/100</span>
                    {contribution != null ? (
                      <span className="ml-1.5 text-[11px] font-medium text-slate-400">
                        · {contribution}/30
                      </span>
                    ) : (
                      <span className="ml-1.5 text-[11px] font-medium text-slate-400">
                        · radar
                      </span>
                    )}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
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
              </div>
            );
          })}
        </div>
        {empathyNote ? (
          <p className="border-l-2 border-[#345884]/30 pl-3 text-xs leading-relaxed text-slate-500">
            Empatia · {empathyNote}
          </p>
        ) : null}
      </section>

      {/* Economy + Legal — compact twin strip */}
      <section className="grid grid-cols-1 gap-4 border-y border-slate-200 py-4 sm:grid-cols-2 sm:gap-6">
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[#1E324E]">Bilancio SSN</h2>
            {economicAnalysis ? (
              <span className="text-[12px] font-semibold tabular-nums text-slate-700">
                €{economicAnalysis.actualSpent.toFixed(0)}
                <span className="font-normal text-slate-400">
                  {" "}
                  / {economicAnalysis.targetBudget.toFixed(0)}
                </span>
              </span>
            ) : null}
          </div>
          {economicAnalysis ? (
            <>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-700",
                    overspend > 0 ? "bg-rose-600" : "bg-[#345884]",
                  )}
                  style={{ width: `${Math.min(100, budgetRatio)}%` }}
                />
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">
                {overspend > 0
                  ? `Sforamento +€${overspend.toFixed(0)}`
                  : "Budget entro soglia"}
                {wastedEuro > 0 ? ` · sprechi €${wastedEuro.toFixed(0)}` : null}
              </p>
            </>
          ) : (
            <p className="text-xs text-slate-500">Non disponibile per questa sessione.</p>
          )}
        </div>

        <div className="space-y-2.5">
          <h2 className="text-sm font-semibold text-[#1E324E]">Scudo legale</h2>
          {legalProtectionStatus && shield ? (
            <>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold",
                  shield.tone,
                )}
              >
                <ShieldIcon className="h-3.5 w-3.5" strokeWidth={1.75} />
                {shield.label}
              </span>
              <p className="text-xs leading-relaxed text-slate-600">
                <SafeLlmText as="span" className="whitespace-pre-line">
                  {legalProtectionStatus.justification}
                </SafeLlmText>
              </p>
              {legalSources.length > 0 ? (
                <p className="text-[11px] text-slate-400">Fonti · {legalSources.join(" · ")}</p>
              ) : null}
            </>
          ) : (
            <p className="text-xs text-slate-500">Stato tutela non disponibile.</p>
          )}
        </div>
      </section>

      {/* Secondary — accordions, no card chrome */}
      <section className="space-y-0">
        {clinicalDeltaTable.length > 0 ? (
          <Accordion title="Confronto Gold Standard" count={clinicalDeltaTable.length}>
            <ul className="space-y-2.5">
              {clinicalDeltaTable.map((row, idx) => (
                <li
                  key={`${row.protocolAction}-${idx}`}
                  className="grid gap-1 border-l-2 border-slate-200 pl-3 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-4"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-[13px] font-medium text-slate-800">{row.protocolAction}</p>
                    <p className="text-xs leading-relaxed text-slate-500">
                      <SafeLlmText as="span">{row.userAction}</SafeLlmText>
                    </p>
                  </div>
                  <span
                    className={cn(
                      "text-[11px] font-semibold sm:pt-0.5",
                      statusMeta(row.status),
                    )}
                  >
                    {statusLabel(row.status)}
                  </span>
                </li>
              ))}
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
                    <div key={i} className="space-y-0.5">
                      <div className="flex justify-between gap-2 text-[13px]">
                        <span className="font-medium text-slate-800">{item.examName}</span>
                        <span className="tabular-nums text-rose-700">€{item.cost.toFixed(0)}</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-500">{item.reason}</p>
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
                    <div key={i} className="space-y-0.5">
                      <div className="flex justify-between gap-2 text-[13px]">
                        <span className="font-medium text-slate-800">{item.examName}</span>
                        <span className="tabular-nums text-amber-800">€{item.cost.toFixed(0)}</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-500">{item.reason}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Accordion>
        ) : null}

        {coachingFeedback ? (
          <Accordion title="Coaching">
            <dl className="space-y-3">
              {COACH_ROWS.map(({ key, label }) => {
                const text = coachingFeedback[key];
                if (!text?.trim()) return null;
                return (
                  <div key={key} className="grid gap-1 sm:grid-cols-[5.5rem_1fr]">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#345884]">
                      {label}
                    </dt>
                    <dd className="text-xs leading-relaxed text-slate-600">
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
            defaultOpen={strengths.length + weaknesses.length <= 4}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Forze
                </p>
                {strengths.length === 0 ? (
                  <p className="text-xs text-slate-500">—</p>
                ) : (
                  <ul className="space-y-1.5">
                    {strengths.map((item, idx) => (
                      <li
                        key={idx}
                        className="border-l-2 border-[#345884]/35 pl-2.5 text-xs leading-relaxed text-slate-600"
                      >
                        <SafeLlmText as="span">{item}</SafeLlmText>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Miglioramenti
                </p>
                {weaknesses.length === 0 ? (
                  <p className="text-xs text-slate-500">—</p>
                ) : (
                  <ul className="space-y-1.5">
                    {weaknesses.map((item, idx) => (
                      <li
                        key={idx}
                        className="border-l-2 border-amber-400/70 pl-2.5 text-xs leading-relaxed text-slate-600"
                      >
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
          <Accordion title="Gestione esperta di riferimento">
            <p className="text-sm leading-relaxed text-slate-600">
              <SafeLlmText as="span" className="whitespace-pre-line">
                {correctSolution}
              </SafeLlmText>
            </p>
          </Accordion>
        ) : null}

        <Accordion title="Radar competenze">
          <div className="h-64 w-full">
            <ResultsRadarClient data={radarData} />
          </div>
        </Accordion>
      </section>
    </div>
  );
}
