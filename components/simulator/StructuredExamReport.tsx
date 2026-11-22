"use client";

import { cn } from "@/app/utils/cn";
import {
  isPlaceholderExamFinding,
  type ClinicalExamReport,
  type ExamReportFlag,
} from "@/lib/simulator/exam-report";

export type ExamReportUiState =
  | { status: "loading" }
  | { status: "ready"; report: ClinicalExamReport }
  | { status: "fallback"; text: string };

const FLAG_LABEL: Record<ExamReportFlag, string> = {
  H: "H",
  L: "L",
  N: "N",
  CRITICAL: "CRIT",
};

const FLAG_CLASS: Record<ExamReportFlag, string> = {
  H: "bg-amber-50 text-amber-800",
  L: "bg-sky-50 text-sky-800",
  N: "bg-transparent text-slate-500",
  CRITICAL: "bg-rose-50 font-semibold text-rose-800",
};

function ParameterTable({ report }: { report: ClinicalExamReport }) {
  const rows = report.parameters ?? [];
  if (rows.length === 0) return null;
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full min-w-[28rem] border-collapse text-left text-[11px]">
        <thead>
          <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-400">
            <th className="py-1.5 pr-2 font-medium">Parametro</th>
            <th className="py-1.5 pr-2 font-medium">Risultato</th>
            <th className="py-1.5 pr-2 font-medium">Unità</th>
            <th className="py-1.5 pr-2 font-medium">Range</th>
            <th className="py-1.5 font-medium">Stato</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.name}-${row.value}`}
              className={cn(
                "border-b border-slate-100 last:border-0",
                row.flag === "CRITICAL" && "bg-rose-50/70",
                row.flag === "H" && "bg-amber-50/50",
                row.flag === "L" && "bg-sky-50/50",
              )}
            >
              <td className="py-1.5 pr-2 font-medium text-slate-800">{row.name}</td>
              <td className="py-1.5 pr-2 tabular-nums text-slate-900">{row.value}</td>
              <td className="py-1.5 pr-2 text-slate-500">{row.unit || "—"}</td>
              <td className="py-1.5 pr-2 text-slate-500">{row.referenceRange || "—"}</td>
              <td className="py-1.5">
                <span
                  className={cn(
                    "inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                    FLAG_CLASS[row.flag],
                  )}
                >
                  {FLAG_LABEL[row.flag]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionList({ report }: { report: ClinicalExamReport }) {
  const sections = report.sections ?? [];
  if (sections.length === 0) return null;
  return (
    <div className="mt-2 space-y-2.5">
      {sections.map((section) => (
        <div key={section.heading}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {section.heading}
          </p>
          <p className="mt-0.5 whitespace-pre-line text-xs leading-relaxed text-slate-700">
            {section.content}
          </p>
        </div>
      ))}
    </div>
  );
}

function ReportBody({ report }: { report: ClinicalExamReport }) {
  const tabular = report.category === "lab" || report.category === "ega";
  const hasParameters = (report.parameters?.length ?? 0) > 0;
  const hasSections = (report.sections?.length ?? 0) > 0;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
            report.isAbnormal ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700",
          )}
        >
          {report.isAbnormal ? "Alterato" : "Nei limiti"}
        </span>
      </div>
      {report.summary ? (
        <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-slate-700">
          {report.summary}
        </p>
      ) : null}
      {tabular && hasParameters ? <ParameterTable report={report} /> : null}
      {!tabular && hasSections ? <SectionList report={report} /> : null}
      {tabular && !hasParameters && report.formattedText ? (
        <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-slate-700">
          {report.formattedText}
        </p>
      ) : null}
      {!tabular && !hasSections && report.formattedText && report.formattedText !== report.summary ? (
        <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-slate-700">
          {report.formattedText}
        </p>
      ) : null}
      {report.category === "microbiology" && hasParameters ? <ParameterTable report={report} /> : null}
    </div>
  );
}

export function StructuredExamReport({
  state,
  className,
}: {
  state: ExamReportUiState | undefined;
  className?: string;
}) {
  const resolved = state ?? { status: "loading" as const };

  if (resolved.status === "loading") {
    return (
      <p className={cn("text-xs font-medium text-[#345884]", className)} role="status">
        Refertazione in corso...
      </p>
    );
  }

  if (resolved.status === "ready") {
    return (
      <div className={className}>
        <ReportBody report={resolved.report} />
      </div>
    );
  }

  const fallback = isPlaceholderExamFinding(resolved.text) ? "" : resolved.text.trim();
  if (!fallback) {
    return (
      <p className={cn("text-xs text-slate-500", className)}>
        Referto temporaneamente non disponibile.
      </p>
    );
  }

  return (
    <p className={cn("whitespace-pre-line text-xs leading-relaxed text-slate-600", className)}>
      {fallback}
    </p>
  );
}
