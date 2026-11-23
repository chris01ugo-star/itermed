import { Search } from "lucide-react";
import { ClinicalCaseCard, type ClinicalCaseRow } from "@/components/dashboard/ClinicalCaseCard";

type ClinicalCaseGridProps = {
  cases: ClinicalCaseRow[];
  mode?: "start" | "link";
  emptyMessage?: string;
  requiresPaidPlan?: boolean;
  adminBypass?: boolean;
};

function CasesEmptyState({ message }: { message: string }) {
  return (
    <div className="col-span-full rounded-xl border border-dashed border-slate-200 bg-slate-50/40 px-6 py-12 text-center">
      <Search className="mx-auto h-8 w-8 text-slate-300" strokeWidth={1.5} aria-hidden />
      <p className="mt-3 text-sm font-medium text-slate-400">{message}</p>
    </div>
  );
}

export function ClinicalCaseGrid({
  cases,
  mode = "start",
  emptyMessage,
  requiresPaidPlan = false,
  adminBypass = false,
}: ClinicalCaseGridProps) {
  if (cases.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <CasesEmptyState message={emptyMessage ?? "Nessun caso con i filtri attivi."} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {cases.map((caseRow) => (
        <ClinicalCaseCard
          key={caseRow.id}
          caseRow={caseRow}
          mode={mode}
          requiresPaidPlan={requiresPaidPlan}
          adminBypass={adminBypass}
        />
      ))}
    </div>
  );
}
