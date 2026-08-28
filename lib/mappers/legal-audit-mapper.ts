import type { LegalAuditResult } from "@/lib/services/legal-audit-service";

export interface FormattedLegalReportDTO {
  isEvaluated: boolean;
  verdictBadge: {
    code: "FULLY_PROTECTED" | "PARTIALLY_PROTECTED" | "LEGAL_RISK_EXPOSED" | "NOT_EVALUABLE";
    label: string;
    severity: "success" | "warning" | "danger" | "info";
  };
  compliancePercentage: number;
  summaryText: string;
  compliantActions: Array<{
    action: string;
    citation: string;
    chunkId: string;
  }>;
  criticalOmissions: Array<{
    action: string;
    riskDescription: string;
    violatedCitation: string;
    chunkId: string;
  }>;
  uncoveredAreas: string[];
}

export function mapLegalAuditToDTO(
  legalAudit?: LegalAuditResult | null,
): FormattedLegalReportDTO {
  if (
    !legalAudit ||
    legalAudit.status === "NOT_EVALUABLE_NO_SOURCES" ||
    legalAudit.overallVerdict === "NOT_EVALUABLE"
  ) {
    return {
      isEvaluated: false,
      verdictBadge: {
        code: "NOT_EVALUABLE",
        label: "NON VALUTABILE (Fonti non presenti per la specialità)",
        severity: "info",
      },
      compliancePercentage: 0,
      summaryText:
        "Per questa specialità/caso non sono stati ancora caricati documenti di tutela legale o linee guida accreditate sul database di sistema.",
      compliantActions: [],
      criticalOmissions: [],
      uncoveredAreas: legalAudit?.uncoveredAreas || [
        "Nessuna fonte di riferimento trovata con soglia di pertinenza >= 0.70.",
      ],
    };
  }

  let badgeLabel = "TUTELATO";
  let severity: "success" | "warning" | "danger" | "info" = "success";

  if (legalAudit.overallVerdict === "PARTIALLY_PROTECTED") {
    badgeLabel = "PARZIALMENTE TUTELATO";
    severity = "warning";
  } else if (legalAudit.overallVerdict === "LEGAL_RISK_EXPOSED") {
    badgeLabel = "ESPOSTO A RISCHIO LEGALE";
    severity = "danger";
  }

  return {
    isEvaluated: true,
    verdictBadge: {
      code: legalAudit.overallVerdict,
      label: badgeLabel,
      severity,
    },
    compliancePercentage: legalAudit.complianceScore,
    summaryText: `Il medico presenta un'aderenza del ${legalAudit.complianceScore}% alle linee guida e alla normativa di riferimento applicabile.`,
    compliantActions: legalAudit.compliantActions.map((a) => ({
      action: a.performedAction,
      citation: a.supportingGuidelineRef,
      chunkId: a.chunkId,
    })),
    criticalOmissions: legalAudit.legalOmissionsOrRisks.map((o) => ({
      action: o.missedOrErroneousAction,
      riskDescription: o.legalRiskDescription,
      violatedCitation: o.violatedGuidelineRef,
      chunkId: o.chunkId,
    })),
    uncoveredAreas: legalAudit.uncoveredAreas || [],
  };
}
