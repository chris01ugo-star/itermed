import type { ClinicalCoachInsight } from "@/lib/statistics-queries";

type AiClinicalCoachProps = {
  insights: ClinicalCoachInsight[];
};

export function AiClinicalCoach({ insights }: AiClinicalCoachProps) {
  if (insights.length === 0) {
    return (
      <p className="py-4 text-sm text-slate-500">
        Dopo il primo caso chiuso vedrai qui le aree da rinforzare.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {insights.map((insight, index) => (
        <article key={insight.priorityArea} className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {index + 1}.
              </p>
              <h3 className="mt-0.5 text-sm font-semibold text-[#1E324E]">{insight.priorityArea}</h3>
            </div>
            <span className="tabular-nums text-sm font-semibold text-[#1E324E]">
              {insight.score}/100
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{insight.recommendation}</p>
        </article>
      ))}
    </div>
  );
}
