"use client";

import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Euro,
  HeartHandshake,
  Scale,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
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
import { ScoreProgressRing } from "./ScoreProgressRing";
import { ResultsRadarClient, type RadarDatum } from "./ResultsRadarClient";
import { EconomicBudgetGauge } from "./EconomicBudgetGauge";
import { GoldStandardCompare } from "./GoldStandardCompare";
import { AiTransparencyBadge } from "@/components/legal/AiTransparencyBadge";
import { CLINICAL_PASS_TRENTESIMI, clampPercentScore, safeDisplayTrentesimi } from "@/lib/scoring/trentesimi";
import {
  MACRO_AREA_WEIGHTS,
  dimensionContributionTrentesimi,
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
};

const PILLARS: Array<{
  key: string;
  label: string;
  icon: LucideIcon;
  fallbackIndex: number;
  /** Official /30 weight; null = analytical radar metric only (not in final grade). */
  gradeWeight: number | null;
  scaleHint: string;
}> = [
  {
    key: "clinicalAccuracy",
    label: "Accuratezza Clinica",
    icon: Stethoscope,
    fallbackIndex: 0,
    gradeWeight: MACRO_AREA_WEIGHTS.clinicalDiagnostic,
    scaleHint: "30% del voto · max 9/30",
  },
  {
    key: "legalComplianceGelliBianco",
    label: "Tutela Medico-Legale",
    icon: Scale,
    fallbackIndex: 1,
    gradeWeight: MACRO_AREA_WEIGHTS.legalCompliance,
    scaleHint: "30% del voto · max 9/30",
  },
  {
    key: "prescribingAppropriateness",
    label: "Appropriatezza Esami",
    icon: Activity,
    fallbackIndex: 2,
    gradeWeight: MACRO_AREA_WEIGHTS.examAppropriateness,
    scaleHint: "20% del voto · max 6/30",
  },
  {
    key: "economicSustainability",
    label: "Sostenibilità Economica",
    icon: Euro,
    fallbackIndex: 3,
    gradeWeight: null,
    scaleHint: "Metrica analitica · non pesa sul /30",
  },
  {
    key: "empathy",
    label: "Empatia Clinica",
    icon: HeartHandshake,
    fallbackIndex: 4,
    gradeWeight: MACRO_AREA_WEIGHTS.empathy,
    scaleHint: "20% del voto · max 6/30",
  },
];

const COACH_CARDS: Array<{
  key: keyof CoachingFeedback;
  label: string;
  icon: LucideIcon;
}> = [
  { key: "accuratezza", label: "Accuratezza clinica", icon: Stethoscope },
  { key: "tutelaLegale", label: "Tutela legale", icon: Scale },
  { key: "economicita", label: "Economicità", icon: Euro },
  { key: "empatia", label: "Empatia", icon: HeartHandshake },
];

function legalShieldConfig(status: LegalProtectionStatus["status"]) {
  switch (status) {
    case "PROTECTED":
      return {
        label: "Protetto",
        icon: ShieldCheck,
        rail: "border-l-brand-secondary",
        badge: "border-brand-secondary/25 bg-brand-secondary/10 text-brand-primary",
        accent: "text-brand-secondary",
        wash: "from-brand-secondary/[0.06]",
      };
    case "PARTIALLY_EXPOSED":
      return {
        label: "Parzialmente esposto",
        icon: Shield,
        rail: "border-l-status-warn",
        badge: "border-amber-200 bg-amber-50 text-amber-900",
        accent: "text-amber-800",
        wash: "from-amber-50/80",
      };
    default:
      return {
        label: "Altamente esposto",
        icon: ShieldAlert,
        rail: "border-l-status-risk",
        badge: "border-rose-200 bg-rose-50 text-rose-800",
        accent: "text-rose-700",
        wash: "from-rose-50/80",
      };
  }
}

function resolvePillarScore(radarData: RadarDatumWithKey[], pillar: (typeof PILLARS)[number]) {
  const byKey = radarData.find((d) => d.key === pillar.key);
  const raw = byKey?.score ?? radarData[pillar.fallbackIndex]?.score ?? 0;
  return clampPercentScore(raw);
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

function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-panel-bg shadow-aequan-panel",
        className,
      )}
    >
      {children}
    </div>
  );
}

function PanelHeader({
  title,
  description,
  icon,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-border-subtle px-5 py-4 md:px-6">
      {icon ? (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          {icon}
        </div>
      ) : null}
      <div className="min-w-0 space-y-0.5">
        <h2 className="font-display text-sm font-semibold text-brand-primary">{title}</h2>
        {description ? <p className="text-xs leading-relaxed text-slate-500">{description}</p> : null}
      </div>
    </div>
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

  const budgetRespected = economicAnalysis
    ? economicAnalysis.actualSpent <= economicAnalysis.targetBudget
    : true;

  return (
    <div className="space-y-6 text-text-primary">
      <AiTransparencyBadge variant="report" className="results-section-enter border-border bg-ui-bg/80" />

      {dismissed ? (
        <Section
          delayMs={40}
          className="flex items-start gap-3 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 shadow-aequan-panel"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
          <p className="text-xs leading-relaxed text-amber-950">
            Caso abbandonato: i punteggi sono stati registrati a 0 su tutti gli assi.
          </p>
        </Section>
      ) : null}

      {/* Hero */}
      <Section
        delayMs={60}
        className="relative overflow-hidden rounded-xl border border-border bg-panel-bg shadow-aequan-panel"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_0%_0%,rgba(52,88,132,0.1),transparent_55%),radial-gradient(ellipse_at_100%_100%,rgba(30,50,78,0.06),transparent_50%)]"
          aria-hidden
        />
        <div className="absolute inset-y-0 left-0 w-1 bg-brand-primary" aria-hidden />

        <div className="relative flex flex-col gap-6 p-5 md:flex-row md:items-end md:justify-between md:p-7">
          <div className="max-w-xl space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-secondary">
              AEQUAN · Report di valutazione
            </p>
            <h1 className="font-display text-[1.65rem] font-bold tracking-tight text-text-primary md:text-[1.85rem]">
              Valutazione clinica e medico-legale
            </h1>
            <p className="text-sm leading-relaxed text-slate-500">
              Analisi multidimensionale con delta Gold Standard, bilancio economico e coaching AI.
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-start rounded-xl border border-brand-secondary/15 bg-brand-secondary/[0.06] px-5 py-4 md:items-end">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Score complessivo
            </span>
            <p className="mt-1 font-display text-4xl font-bold tabular-nums tracking-tight text-brand-primary">
              {Math.round(normalizedScore * 10) / 10}
              <span className="ml-0.5 text-lg font-medium text-slate-400">/30</span>
            </p>
            <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
              Scala trentesimi
            </p>
          </div>
        </div>

        {showKillerSwitchBanner ? (
          <div
            role="alert"
            className="relative mx-5 mb-5 rounded-xl border border-red-500/50 bg-red-950/40 px-4 py-3 text-rose-100 md:mx-7 md:mb-6"
          >
            <div className="flex items-start gap-2.5">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden />
              <div className="min-w-0 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-red-300">
                  Bocciatura d&apos;ufficio (Killer-Switch applicato)
                </p>
                <p className="text-xs leading-relaxed text-rose-100/90">
                  Il voto complessivo è stato limitato d&apos;ufficio a {killerCap}/30 per uno o più
                  errori clinici o legali fatali. I punteggi parziali (Clinica, Tutela, Esami,
                  Empatia) restano autentici sul radar: interviene solo il totale hero.
                  {killerSwitch?.applied &&
                  typeof killerSwitch.rawTotalTrentesimi === "number" &&
                  typeof killerSwitch.finalTotalTrentesimi === "number"
                    ? ` Calcolo grezzo: ${killerSwitch.rawTotalTrentesimi}/30 → voto finale: ${killerSwitch.finalTotalTrentesimi}/30.`
                    : null}
                </p>
                {fatalErrors.length > 0 ? (
                  <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-rose-100/85">
                    {fatalErrors.map((error) => (
                      <li key={error.code}>
                        <span className="font-mono text-[10px] text-red-300/80">{error.code}</span>
                        {" — "}
                        {error.description}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </Section>

      {/* Scudo Legale */}
      {legalProtectionStatus && shield ? (
        <Section delayMs={100}>
          <article
            className={cn(
              "overflow-hidden rounded-xl border border-border border-l-4 bg-gradient-to-br to-panel-bg p-5 shadow-aequan-panel md:p-6",
              shield.rail,
              shield.wash,
            )}
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-start">
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border",
                  shield.badge,
                )}
              >
                <ShieldIcon className={cn("h-6 w-6", shield.accent)} />
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="font-display text-base font-semibold text-brand-primary">
                    Scudo Legale
                  </h2>
                  <span
                    className={cn(
                      "rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      shield.badge,
                    )}
                  >
                    {shield.label}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-slate-600">
                  <SafeLlmText as="span" className="whitespace-pre-line">
                    {legalProtectionStatus.justification}
                  </SafeLlmText>
                </p>
                {legalProtectionStatus.referenceDocuments.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {legalProtectionStatus.referenceDocuments.map((doc) => (
                      <span
                        key={doc}
                        className="rounded-md border border-border bg-ui-bg/80 px-2 py-1 text-[10px] font-medium text-slate-600"
                      >
                        {doc}
                      </span>
                    ))}
                  </div>
                ) : null}
                {legalSources.length > 0 ? (
                  <p className="text-[11px] text-slate-500">
                    Fonti RAG: {legalSources.join(" · ")}
                  </p>
                ) : null}
              </div>
            </div>
          </article>
        </Section>
      ) : null}

      {/* Pilastri + Bilancio */}
      <Section
        delayMs={140}
        className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start"
      >
        <Panel className="lg:col-span-7 xl:col-span-8">
          <PanelHeader
            title="Cinque pilastri AEQUAN"
            description="Quattro dimensioni pesano sul voto /30 (30%+30%+20%+20%). La sostenibilità economica è metrica analitica (radar/bilancio), distinta dall'appropriatezza prescrittiva degli esami."
            icon={<Activity className="h-4 w-4" />}
          />
          <div className="space-y-6 p-5 md:p-6">
            <div className="grid grid-cols-2 gap-x-2 gap-y-6 sm:grid-cols-3 md:grid-cols-5 md:gap-x-1">
              {PILLARS.map((pillar) => {
                const Icon = pillar.icon;
                const score = resolvePillarScore(radarData, pillar);
                const contribution =
                  pillar.gradeWeight != null
                    ? dimensionContributionTrentesimi(score, pillar.gradeWeight)
                    : null;
                return (
                  <ScoreProgressRing
                    key={pillar.key}
                    compact
                    size={100}
                    score={score}
                    label={pillar.label}
                    subtitle={
                      contribution != null
                        ? `${Math.round(score)}/100 · ${contribution}/30`
                        : `${Math.round(score)}/100 · radar`
                    }
                    icon={<Icon className="h-4 w-4" />}
                    className="results-pillar-enter"
                  />
                );
              })}
            </div>

            <div className="space-y-3 border-t border-border-subtle pt-5">
              {PILLARS.map((pillar) => {
                const score = resolvePillarScore(radarData, pillar);
                const contribution =
                  pillar.gradeWeight != null
                    ? dimensionContributionTrentesimi(score, pillar.gradeWeight)
                    : null;
                const Icon = pillar.icon;
                return (
                  <div key={`row-${pillar.key}`} className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-secondary/10 text-brand-secondary">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <span className="block truncate text-xs font-medium text-slate-600">
                            {pillar.label}
                          </span>
                          <span className="block truncate text-[10px] text-slate-400">
                            {pillar.scaleHint}
                          </span>
                        </div>
                        <span className="shrink-0 text-right text-xs font-semibold tabular-nums text-brand-primary">
                          {Math.round(score)}
                          <span className="font-medium text-slate-400">/100</span>
                          {contribution != null ? (
                            <span className="mt-0.5 block text-[10px] font-medium text-slate-500">
                              → {contribution}/30
                            </span>
                          ) : (
                            <span className="mt-0.5 block text-[10px] font-medium text-slate-400">
                              non in /30
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-brand-secondary transition-all duration-700 ease-out"
                          style={{ width: `${score}%` }}
                          role="progressbar"
                          aria-valuenow={Math.round(score)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${pillar.label}: ${Math.round(score)} su 100`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-border-subtle pt-5">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Radar competenze vs target
              </p>
              <div className="h-80 w-full rounded-xl border border-border bg-ui-bg/50 p-3">
                <ResultsRadarClient data={radarData} />
              </div>
            </div>
          </div>
        </Panel>

        <Panel className="border-brand-secondary/15 bg-gradient-to-b from-brand-secondary/[0.05] to-panel-bg lg:col-span-5 xl:col-span-4">
          <PanelHeader
            title="Bilancio economico SSN"
            description="Budget assegnato vs spesa effettuata."
            icon={<Euro className="h-4 w-4" />}
          />
          <div className="space-y-4 p-5 md:p-6">
            {economicAnalysis ? (
              <>
                <div className="rounded-xl border border-border bg-panel-bg/90 p-4">
                  <EconomicBudgetGauge
                    targetBudget={economicAnalysis.targetBudget}
                    actualSpent={economicAnalysis.actualSpent}
                    wastedEuro={wastedEuro}
                  />
                </div>

                {overspend > 0 ? (
                  <p className="flex items-center gap-1.5 rounded-xl border border-rose-200/80 bg-rose-50/80 px-3 py-2.5 text-[11px] text-rose-800">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Sforamento budget: +€{overspend.toFixed(2)} rispetto al target SSN.
                  </p>
                ) : budgetRespected ? (
                  <p className="rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-3 py-2.5 text-[11px] font-medium text-emerald-800">
                    Budget rispettato — spesa entro soglia di appropriatezza.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="rounded-xl border border-dashed border-border bg-ui-bg/60 px-4 py-10 text-center text-xs leading-relaxed text-slate-500">
                Bilancio economico non disponibile per questa sessione.
              </p>
            )}
          </div>
        </Panel>
      </Section>

      {clinicalDeltaTable.length > 0 ? (
        <Section delayMs={180}>
          <GoldStandardCompare rows={clinicalDeltaTable} />
        </Section>
      ) : null}

      {economicAnalysis &&
      (economicAnalysis.unnecessaryExpenses.length > 0 ||
        economicAnalysis.missedRequiredExams.length > 0) ? (
        <Section delayMs={200} className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Panel className="overflow-hidden border-rose-200/70">
            <div className="flex items-center gap-2 border-b border-rose-100 bg-rose-50/50 px-5 py-3.5">
              <XCircle className="h-4 w-4 text-rose-700" />
              <h2 className="font-display text-sm font-semibold text-rose-800">Spese superflue</h2>
            </div>
            <div className="space-y-2 p-4 md:p-5">
              {economicAnalysis.unnecessaryExpenses.length === 0 ? (
                <p className="text-xs text-slate-500">Nessuna spesa superflua rilevata.</p>
              ) : (
                economicAnalysis.unnecessaryExpenses.map((item, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-rose-100 bg-ui-bg/40 px-3.5 py-2.5"
                  >
                    <div className="flex justify-between gap-2">
                      <span className="text-sm font-medium text-slate-800">{item.examName}</span>
                      <span className="text-sm font-semibold tabular-nums text-rose-700">
                        €{item.cost.toFixed(2)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{item.reason}</p>
                  </div>
                ))
              )}
            </div>
          </Panel>

          <Panel className="overflow-hidden border-amber-200/70">
            <div className="flex items-center gap-2 border-b border-amber-100 bg-amber-50/50 px-5 py-3.5">
              <AlertTriangle className="h-4 w-4 text-amber-800" />
              <h2 className="font-display text-sm font-semibold text-amber-950">Esami mancati</h2>
            </div>
            <div className="space-y-2 p-4 md:p-5">
              {economicAnalysis.missedRequiredExams.length === 0 ? (
                <p className="text-xs text-slate-500">Nessun esame obbligatorio omesso.</p>
              ) : (
                economicAnalysis.missedRequiredExams.map((item, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-amber-100 bg-ui-bg/40 px-3.5 py-2.5"
                  >
                    <div className="flex justify-between gap-2">
                      <span className="text-sm font-medium text-slate-800">{item.examName}</span>
                      <span className="text-sm font-semibold tabular-nums text-amber-800">
                        €{item.cost.toFixed(2)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{item.reason}</p>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </Section>
      ) : null}

      {coachingFeedback ? (
        <Section delayMs={220}>
          <Panel>
            <PanelHeader
              title="AI Clinical Coach"
              description="Feedback mirato sui quattro assi di coaching."
              icon={<Sparkles className="h-4 w-4" />}
            />
            <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 md:p-6 lg:grid-cols-2 xl:grid-cols-4">
              {COACH_CARDS.map(({ key, label, icon: Icon }) => (
                <div
                  key={key}
                  className="space-y-2.5 rounded-xl border border-border border-l-[3px] border-l-brand-primary bg-ui-bg/40 p-4"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-brand-secondary" />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                      {label}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-600">
                    <SafeLlmText as="span" className="whitespace-pre-line">
                      {coachingFeedback[key] ?? ""}
                    </SafeLlmText>
                  </p>
                </div>
              ))}
            </div>
          </Panel>
        </Section>
      ) : null}

      <Section delayMs={240} className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Panel>
          <PanelHeader title="Punti di forza" />
          <div className="space-y-2 p-5">
            {strengths.length === 0 ? (
              <p className="text-xs text-slate-500">Nessun punto di forza specifico.</p>
            ) : (
              <ul className="space-y-2">
                {strengths.map((item, idx) => (
                  <li
                    key={idx}
                    className="rounded-lg border-l-[3px] border-l-brand-secondary bg-ui-bg/50 px-3.5 py-2.5 text-xs leading-relaxed text-slate-600"
                  >
                    <SafeLlmText as="span">{item}</SafeLlmText>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Aree di miglioramento" />
          <div className="space-y-2 p-5">
            {weaknesses.length === 0 ? (
              <p className="text-xs text-slate-500">Nessuna criticità specifica.</p>
            ) : (
              <ul className="space-y-2">
                {weaknesses.map((item, idx) => (
                  <li
                    key={idx}
                    className="rounded-lg border-l-[3px] border-l-amber-500 bg-ui-bg/50 px-3.5 py-2.5 text-xs leading-relaxed text-slate-600"
                  >
                    <SafeLlmText as="span">{item}</SafeLlmText>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>
      </Section>

      {correctSolution ? (
        <Section delayMs={260}>
          <Panel>
            <PanelHeader
              title="Gestione esperta di riferimento"
              description="Percorso clinico atteso secondo il Gold Standard del caso."
              icon={<Stethoscope className="h-4 w-4" />}
            />
            <div className="p-5 text-sm leading-relaxed text-slate-600 md:p-6">
              <SafeLlmText as="div" className="whitespace-pre-line">
                {correctSolution}
              </SafeLlmText>
            </div>
          </Panel>
        </Section>
      ) : null}
    </div>
  );
}
