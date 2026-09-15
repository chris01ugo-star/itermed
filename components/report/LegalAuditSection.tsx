"use client";

import { CheckCircle2, Scale, ShieldAlert, ShieldCheck, ShieldQuestion, XCircle } from "lucide-react";
import { Badge } from "@/app/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/ui/card";
import { cn } from "@/app/utils/cn";
import { SafeLlmText } from "@/components/ui/safe-llm-content";
import {
  coerceLegalReportDto,
  type FormattedLegalReportDTO,
} from "@/lib/mappers/legal-audit-mapper";
import type { LegalAuditResult } from "@/lib/services/legal-audit-service";

export type LegalAuditSectionProps = {
  legalReport?: FormattedLegalReportDTO | LegalAuditResult | null;
  className?: string;
};

const VERDICT_BADGE_VARIANT: Record<
  FormattedLegalReportDTO["verdictBadge"]["severity"],
  "success" | "warning" | "danger" | "info"
> = {
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "info",
};

const FAULT_CATEGORY_LABEL: Record<
  NonNullable<FormattedLegalReportDTO["comparativeAnalysis"][number]["faultCategory"]>,
  string
> = {
  OTTIMALE: "Ottimale",
  IMPERIZIA_LIEVE: "Imperizia lieve",
  NEGLIGENZA_GRAVE: "Negligenza grave",
  DIFETTO_CONSENSO: "Difetto di consenso",
};

const FAULT_CATEGORY_CLASS: Record<
  NonNullable<FormattedLegalReportDTO["comparativeAnalysis"][number]["faultCategory"]>,
  string
> = {
  OTTIMALE: "text-emerald-700",
  IMPERIZIA_LIEVE: "text-amber-700",
  NEGLIGENZA_GRAVE: "text-rose-700",
  DIFETTO_CONSENSO: "text-rose-700",
};

function VerdictIcon({
  code,
  className,
}: {
  code: FormattedLegalReportDTO["verdictBadge"]["code"];
  className?: string;
}) {
  if (code === "FULLY_PROTECTED") return <ShieldCheck className={className} strokeWidth={1.75} />;
  if (code === "NOT_EVALUABLE") return <ShieldQuestion className={className} strokeWidth={1.75} />;
  return <ShieldAlert className={className} strokeWidth={1.75} />;
}

export function LegalAuditSection({ legalReport, className }: LegalAuditSectionProps) {
  const report = coerceLegalReportDto(legalReport);
  if (!report) return null;

  const { verdictBadge, isEvaluated, compliancePercentage } = report;
  const rows = (report.comparativeAnalysis ?? []).filter(
    (row) => row.userAction?.trim() || row.requiredAction?.trim(),
  );

  return (
    <Card
      className={cn(
        "overflow-hidden rounded-none border-[#1E324E]/15 bg-[#FBFCFD] shadow-none hover:shadow-none",
        className,
      )}
    >
      <CardHeader className="border-b border-[#1E324E]/10 bg-[#F4F6F8] px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
              Perizia medico-legale · L. 24/2017
            </p>
            <CardTitle className="mt-1 flex items-center gap-2 font-display text-base text-[#1E324E]">
              <Scale className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              Tutela legale
            </CardTitle>
            <CardDescription className="mt-1">
              Perizia medico-legale sul livello di tutela del medico.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={VERDICT_BADGE_VARIANT[verdictBadge.severity]}
              className="gap-1.5 rounded-sm px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider"
            >
              <VerdictIcon code={verdictBadge.code} className="h-3.5 w-3.5" />
              {verdictBadge.label}
            </Badge>
            {isEvaluated ? (
              <p className="font-display text-xl font-semibold tabular-nums text-[#1E324E]">
                {Math.round(compliancePercentage)}
                <span className="ml-0.5 text-sm font-medium text-slate-500">/100</span>
              </p>
            ) : null}
          </div>
        </div>
        {report.executiveSummary?.trim() ? (
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground text-slate-600">
            <SafeLlmText as="span">{report.executiveSummary}</SafeLlmText>
          </p>
        ) : null}
        {report.cognitiveBiases && report.cognitiveBiases.length > 0 ? (
          <div
            role="alert"
            className="mt-4 max-w-3xl border-2 border-amber-500 bg-amber-50 px-4 py-3"
          >
            <p className="mb-2 text-sm font-bold text-amber-950">
              🧠 Fattori Umani e Bias Cognitivi
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              {report.cognitiveBiases.map((bias, index) => (
                <li key={`${bias.slice(0, 40)}-${index}`} className="text-sm leading-relaxed text-amber-950">
                  <SafeLlmText as="span">{bias}</SafeLlmText>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="px-5 py-5 sm:px-6">
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">Nessun confronto normativo per questa sessione.</p>
        ) : (
          <ul className="grid gap-4">
            {rows.map((row, index) => (
              <li
                key={`${row.userAction}-${index}`}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
                  {row.isProtected ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" strokeWidth={1.75} aria-label="Tutelato" />
                  ) : (
                    <XCircle className="h-5 w-5 shrink-0 text-rose-600" strokeWidth={1.75} aria-label="Esposto" />
                  )}
                  <span
                    className={cn(
                      "text-[10px] font-extrabold uppercase tracking-wider",
                      row.isProtected ? "text-emerald-700" : "text-rose-700",
                    )}
                  >
                    {row.isProtected ? "Tutelato" : "Esposto"}
                  </span>
                  {row.faultCategory ? (
                    <span
                      className={cn(
                        "text-[10px] font-extrabold uppercase tracking-wider",
                        FAULT_CATEGORY_CLASS[row.faultCategory],
                      )}
                    >
                      · {FAULT_CATEGORY_LABEL[row.faultCategory]}
                    </span>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      Cosa hai fatto
                    </p>
                    <SafeLlmText className="text-sm font-medium leading-snug text-slate-900">
                      {row.userAction}
                    </SafeLlmText>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      Cosa avresti dovuto fare
                    </p>
                    <SafeLlmText className="text-sm leading-snug text-slate-800">
                      {row.requiredAction}
                    </SafeLlmText>
                  </div>
                </div>

                {row.temporalRelevance?.trim() ? (
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      Tempestività{" "}
                    </span>
                    <SafeLlmText as="span">{row.temporalRelevance}</SafeLlmText>
                  </p>
                ) : null}

                {row.explanation?.trim() || row.sourceQuote?.trim() ? (
                  <div className="mt-3">
                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      Motivazione e fonti
                    </p>
                    {row.explanation?.trim() ? (
                      <SafeLlmText className="text-sm leading-relaxed text-slate-700">
                        {row.explanation}
                      </SafeLlmText>
                    ) : null}
                    {row.sourceQuote?.trim() ? (
                      <blockquote className="mt-2 border-l-4 border-gray-300 italic text-gray-600 px-3 py-2">
                        <SafeLlmText as="span">{row.sourceQuote}</SafeLlmText>
                      </blockquote>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
