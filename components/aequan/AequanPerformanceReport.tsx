"use client";

import {
  HeartHandshake,
  Scale,
  Shield,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import type { MockEvaluationReport } from "@/lib/mock-data/aequan-mock-data";
import { cn } from "@/app/utils/cn";

type AequanPerformanceReportProps = {
  report: MockEvaluationReport;
  className?: string;
};

function legalConfig(status: MockEvaluationReport["legal"]["status"]) {
  switch (status) {
    case "PROTECTED":
      return {
        border: "border-l-status-safe",
        icon: ShieldCheck,
        badge: "bg-status-safe/10 text-status-safe border-status-safe/30",
        label: "LEGALLY PROTECTED",
      };
    case "PARTIALLY_EXPOSED":
      return {
        border: "border-l-status-warn",
        icon: Shield,
        badge: "bg-status-warn/10 text-status-warn border-status-warn/30",
        label: "PARTIALLY EXPOSED",
      };
    default:
      return {
        border: "border-l-status-risk",
        icon: ShieldAlert,
        badge: "bg-status-risk/10 text-status-risk border-status-risk/30",
        label: "LEGAL RISK / NOT PROTECTED",
      };
  }
}

function budgetBarColor(status: MockEvaluationReport["financial"]["budgetStatus"]) {
  switch (status) {
    case "over":
      return "bg-status-risk";
    case "warn":
      return "bg-status-warn";
    default:
      return "bg-status-safe";
  }
}

/**
 * Post-simulation master report — Legal Shield, SSN Audit, Empathy cards.
 */
export function AequanPerformanceReport({ report, className }: AequanPerformanceReportProps) {
  const legal = legalConfig(report.legal.status);
  const LegalIcon = legal.icon;
  const financial = report.financial;
  const pct = Math.min(
    100,
    Math.round((financial.actualCostEur / financial.recommendedCostEur) * 100),
  );
  const overBudget = financial.actualCostEur > financial.recommendedCostEur;

  return (
    <div className={cn("space-y-6", className)}>
      {/* Hero score */}
      <header className="rounded-aequan-xl border border-border bg-panel-bg p-6 shadow-aequan-panel">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-primary">
          AEQUAN · Report Post-Simulazione
        </p>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mt-3">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
              Valutazione Clinica &amp; Medico-Legale
            </h1>
            <p className="text-sm text-text-secondary mt-1 max-w-xl">
              Analisi forense con citazioni RAG, audit costi SSN e valutazione soft skills.
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase tracking-widest text-text-secondary">
              Punteggio OSCE
            </span>
            <p className="text-4xl font-bold font-tabular text-brand-primary">
              {report.totalScore}
              <span className="text-lg font-normal text-text-secondary">
                /{report.maxScore}
              </span>
            </p>
          </div>
        </div>
      </header>

      {/* §1 Legal Shield */}
      <article
        className={cn(
          "rounded-aequan-xl border border-border border-l-4 bg-panel-bg p-6 shadow-aequan-panel aequan-interactive",
          legal.border,
        )}
      >
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <LegalIcon className="h-6 w-6 text-brand-primary" />
          <h2 className="text-lg font-semibold text-text-primary">Scudo Medico-Legale</h2>
          <span
            className={cn(
              "ml-auto rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wide",
              legal.badge,
            )}
          >
            {legal.label}
          </span>
        </div>
        <p className="text-sm font-medium text-text-primary mb-1">{report.legal.headline}</p>
        <p className="text-sm text-text-secondary leading-relaxed mb-5">{report.legal.summary}</p>

        <div className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary flex items-center gap-1.5">
            <Scale className="h-3.5 w-3.5" />
            Citazioni normative e linee guida (RAG locale)
          </p>
          {report.legal.citations.map((cite, i) => (
            <div key={i} className="space-y-1.5">
              <p className="text-xs font-medium text-brand-primary">
                [{cite.ref}] — {cite.source}
              </p>
              <pre className="aequan-citation whitespace-pre-wrap">{cite.excerpt}</pre>
            </div>
          ))}
        </div>
      </article>

      {/* §2 SSN Financial Audit */}
      <article className="rounded-aequan-xl border border-border bg-panel-bg p-6 shadow-aequan-panel">
        <div className="flex items-center gap-3 mb-4">
          <TrendingUp className="h-6 w-6 text-brand-primary" />
          <h2 className="text-lg font-semibold text-text-primary">Audit Finanziario SSN</h2>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="rounded-aequan border border-border bg-ui-bg p-4">
            <p className="text-[10px] uppercase tracking-wide text-text-secondary">Costo effettivo</p>
            <p className="text-2xl font-mono font-tabular font-semibold text-text-primary mt-1">
              €{financial.actualCostEur}
            </p>
          </div>
          <div className="rounded-aequan border border-border bg-ui-bg p-4">
            <p className="text-[10px] uppercase tracking-wide text-text-secondary">
              Budget raccomandato
            </p>
            <p className="text-2xl font-mono font-tabular font-semibold text-brand-primary mt-1">
              €{financial.recommendedCostEur}
            </p>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-xs text-text-secondary">
            <span>Utilizzo budget</span>
            <span className={cn("font-medium", overBudget ? "text-status-warn" : "text-status-safe")}>
              {pct}%
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-ui-bg border border-border overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full aequan-interactive",
                budgetBarColor(financial.budgetStatus),
              )}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        </div>

        {financial.unnecessaryItems.length > 0 && (
          <ul className="space-y-2">
            {financial.unnecessaryItems.map((item, i) => (
              <li
                key={i}
                className="aequan-interactive rounded-aequan border border-status-warn/30 bg-status-warn/5 px-3 py-2 text-xs"
              >
                <span className="font-medium text-text-primary">{item.name}</span>
                <span className="text-status-warn font-mono font-tabular ml-2">
                  €{item.costEur}
                </span>
                <p className="text-text-secondary mt-1">{item.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </article>

      {/* §3 Empathy & Soft Skills */}
      <article className="rounded-aequan-xl border border-border bg-panel-bg p-6 shadow-aequan-panel">
        <div className="flex items-center gap-3 mb-4">
          <HeartHandshake className="h-6 w-6 text-brand-primary" />
          <h2 className="text-lg font-semibold text-text-primary">Comunicazione e Relazione Clinica (D-RIME)</h2>
          <span className="ml-auto text-2xl font-tabular font-semibold text-brand-primary">
            {report.empathy.score}
            <span className="text-sm text-text-secondary">/100</span>
          </span>
        </div>

        <p className="text-sm text-text-secondary leading-relaxed mb-4">{report.empathy.tone}</p>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-aequan border border-status-safe/30 bg-status-safe/5 p-4">
            <p className="text-[10px] font-semibold uppercase text-status-safe mb-2">Punti di forza</p>
            <ul className="space-y-1.5 text-sm text-text-secondary">
              {report.empathy.strengths.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-status-safe shrink-0">✓</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-aequan border border-status-warn/30 bg-status-warn/5 p-4">
            <p className="text-[10px] font-semibold uppercase text-status-warn mb-2">
              Aree di miglioramento
            </p>
            <ul className="space-y-1.5 text-sm text-text-secondary">
              {report.empathy.improvements.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-status-warn shrink-0">→</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {report.empathy.sampleExchanges.map((ex, i) => (
          <blockquote
            key={i}
            className="mt-4 rounded-aequan border-l-2 border-brand-primary bg-ui-bg px-4 py-3 text-sm"
          >
            <p className="text-text-primary italic">&ldquo;{ex.doctor}&rdquo;</p>
            <p className="text-text-secondary text-xs mt-2">{ex.feedback}</p>
          </blockquote>
        ))}
      </article>
    </div>
  );
}
