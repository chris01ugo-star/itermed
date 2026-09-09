import type { ClinicalAuditResult } from "@/lib/services/clinical-audit-service";

export interface FormattedClinicalReportDTO {
  isEvaluated: boolean;
  verdictBadge: {
    code:
      | "EXCELLENT_MANAGEMENT"
      | "SATISFACTORY_MANAGEMENT"
      | "SUBOPTIMAL_MANAGEMENT"
      | "CRITICAL_CLINICAL_ERROR"
      | "NOT_EVALUABLE";
    label: string;
    severity: "success" | "warning" | "danger" | "info";
  };
  accuracyPercentage: number;
  diagnosticMatch: {
    userDiagnosis: string;
    goldDiagnosis: string;
    isCorrect: boolean;
    description: string;
  };
  therapeuticCompliance: {
    correctInterventions: Array<{ actionName: string; guidelineRef: string }>;
    omittedEssentialInterventions: Array<{
      actionName: string;
      clinicalImpact: string;
      guidelineRef: string;
    }>;
    contraindicatedOrIatrogenicActions: Array<{
      actionName: string;
      riskDescription: string;
      isCriticalIatrogenic: boolean;
    }>;
  };
  timeCriticalCompliance: {
    wereTimeLimitsRespected: boolean;
    delayNotes: string[];
  };
  summaryText: string;
}

export function mapClinicalAuditToDTO(
  clinicalAudit?: ClinicalAuditResult | null,
): FormattedClinicalReportDTO {
  if (!clinicalAudit || clinicalAudit.status === "NOT_EVALUABLE") {
    return {
      isEvaluated: false,
      verdictBadge: {
        code: "NOT_EVALUABLE",
        label: "NON VALUTABILE",
        severity: "info",
      },
      accuracyPercentage: 0,
      diagnosticMatch: {
        userDiagnosis: "N/A",
        goldDiagnosis: "N/A",
        isCorrect: false,
        description: "Valutazione clinica non disponibile.",
      },
      therapeuticCompliance: {
        correctInterventions: [],
        omittedEssentialInterventions: [],
        contraindicatedOrIatrogenicActions: [],
      },
      timeCriticalCompliance: {
        wereTimeLimitsRespected: false,
        delayNotes: [],
      },
      summaryText: "Analisi clinico-diagnostica non disponibile per questo caso.",
    };
  }

  let badgeLabel = "GESTIONE ECCELLENTE";
  let severity: "success" | "warning" | "danger" | "info" = "success";

  if (clinicalAudit.overallVerdict === "SATISFACTORY_MANAGEMENT") {
    badgeLabel = "GESTIONE SODDISFACENTE";
    severity = "success";
  } else if (clinicalAudit.overallVerdict === "SUBOPTIMAL_MANAGEMENT") {
    badgeLabel = "GESTIONE SUBOTTIMALE";
    severity = "warning";
  } else if (clinicalAudit.overallVerdict === "CRITICAL_CLINICAL_ERROR") {
    badgeLabel = "ERRORE CLINICO CRITICO";
    severity = "danger";
  }

  return {
    isEvaluated: true,
    verdictBadge: {
      code: clinicalAudit.overallVerdict,
      label: badgeLabel,
      severity,
    },
    accuracyPercentage: clinicalAudit.clinicalAccuracyScore,
    diagnosticMatch: {
      userDiagnosis: clinicalAudit.diagnosticMatch.userDiagnosis,
      goldDiagnosis: clinicalAudit.diagnosticMatch.goldDiagnosis,
      isCorrect: clinicalAudit.diagnosticMatch.isCorrect,
      description: clinicalAudit.diagnosticMatch.diagnosticAccuracyDescription,
    },
    therapeuticCompliance: clinicalAudit.therapeuticCompliance,
    timeCriticalCompliance: clinicalAudit.timeCriticalCompliance,
    summaryText: `Accuratezza clinico-diagnostica complessiva: ${clinicalAudit.clinicalAccuracyScore}%.`,
  };
}
