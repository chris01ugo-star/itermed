import type { EconomicAuditResult } from "@/lib/services/economic-audit-service";

export interface FormattedEconomicReportDTO {
  isEvaluated: boolean;
  verdictBadge: {
    code:
      | "OPTIMAL_EFFICIENCY"
      | "MODERATE_OVERTESTING"
      | "SEVERE_OVERTESTING"
      | "CRITICAL_UNDERTESTING"
      | "NOT_EVALUABLE";
    label: string;
    severity: "success" | "warning" | "danger" | "info";
  };
  efficiencyPercentage: number;
  financialSummary: {
    totalSpentEuro: number;
    idealCostEuro: number;
    deltaEuro: number;
    inappropriateSpendEuro: number;
  };
  inappropriateExams: Array<{
    examId: string;
    examName: string;
    costEuro: number;
    reason: string;
  }>;
  omittedEssentialExams: Array<{
    examId: string;
    examName: string;
    costEuro: number;
    clinicalImpact: string;
  }>;
  summaryText: string;
}

export function mapEconomicAuditToDTO(
  economicAudit?: EconomicAuditResult | null,
): FormattedEconomicReportDTO {
  if (!economicAudit || economicAudit.status === "NOT_EVALUABLE") {
    return {
      isEvaluated: false,
      verdictBadge: {
        code: "NOT_EVALUABLE",
        label: "NON VALUTABILE",
        severity: "info",
      },
      efficiencyPercentage: 0,
      financialSummary: {
        totalSpentEuro: 0,
        idealCostEuro: 0,
        deltaEuro: 0,
        inappropriateSpendEuro: 0,
      },
      inappropriateExams: [],
      omittedEssentialExams: [],
      summaryText: "Dati sull'appropriatezza economica non disponibili per questo caso.",
    };
  }

  let badgeLabel = "EFFICIENZA OTTIMALE";
  let severity: "success" | "warning" | "danger" | "info" = "success";

  if (economicAudit.overallVerdict === "MODERATE_OVERTESTING") {
    badgeLabel = "MODERATO OVER-TESTING";
    severity = "warning";
  } else if (economicAudit.overallVerdict === "SEVERE_OVERTESTING") {
    badgeLabel = "SEVERO OVER-TESTING";
    severity = "danger";
  } else if (economicAudit.overallVerdict === "CRITICAL_UNDERTESTING") {
    badgeLabel = "CRITICAL UNDER-TESTING (Omissioni)";
    severity = "danger";
  }

  return {
    isEvaluated: true,
    verdictBadge: {
      code: economicAudit.overallVerdict,
      label: badgeLabel,
      severity,
    },
    efficiencyPercentage: economicAudit.efficiencyScore,
    financialSummary: economicAudit.financialSummary,
    inappropriateExams: economicAudit.inappropriateExams.map((e) => ({
      examId: e.examId,
      examName: e.examName,
      costEuro: e.costEuro,
      reason: e.reasonForInappropriateness,
    })),
    omittedEssentialExams: economicAudit.omittedEssentialExams.map((o) => ({
      examId: o.examId,
      examName: o.examName,
      costEuro: o.costEuro,
      clinicalImpact: o.clinicalImpactOfOmission,
    })),
    summaryText: `Spesa totale prescritta: €${economicAudit.financialSummary.totalSpentEuro.toFixed(2)} rispetto a una spesa ideale di €${economicAudit.financialSummary.idealCostEuro.toFixed(2)}.`,
  };
}
