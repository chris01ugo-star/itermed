import type { RelationalAuditResult } from "@/lib/services/relational-audit-service";

export interface FormattedRelationalReportDTO {
  isEvaluated: boolean;
  verdictBadge: {
    code:
      | "EXCELLENT_RELATIONAL_CARE"
      | "SATISFACTORY_RELATIONAL_CARE"
      | "MECHANICAL_TRANSACTIONAL"
      | "RELATIONAL_FAIL_OR_IATROGENIC_DISTRESS"
      | "NOT_EVALUABLE";
    label: string;
    severity: "success" | "warning" | "danger" | "info";
  };
  empathyPercentage: number;
  riasMetrics: {
    empathyValidationCount: number;
    jargonWithoutExplanationCount: number;
    activeListeningScore: number;
    sharedDecisionMakingScore: number;
  };
  careMeasureChecklist: Array<{
    dimension: string;
    observed: boolean;
    evidenceUtterance?: string;
    clinicalImpactNote: string;
  }>;
  criticalFlaws: Array<{
    doctorUtteranceOrOmission: string;
    psychologicalImpact: string;
    riasViolationType: string;
    suggestedAlternative: string;
  }>;
  spikesProtocolCompliance: {
    isApplicable: boolean;
    adherenceScorePercentage: number;
    missedSteps: string[];
  };
  summaryText: string;
}

export function mapRelationalAuditToDTO(
  relationalAudit?: RelationalAuditResult | null,
): FormattedRelationalReportDTO {
  if (!relationalAudit || relationalAudit.status === "NOT_EVALUABLE") {
    return {
      isEvaluated: false,
      verdictBadge: {
        code: "NOT_EVALUABLE",
        label: "NON VALUTABILE",
        severity: "info",
      },
      empathyPercentage: 0,
      riasMetrics: {
        empathyValidationCount: 0,
        jargonWithoutExplanationCount: 0,
        activeListeningScore: 0,
        sharedDecisionMakingScore: 0,
      },
      careMeasureChecklist: [],
      criticalFlaws: [],
      spikesProtocolCompliance: {
        isApplicable: false,
        adherenceScorePercentage: 0,
        missedSteps: [],
      },
      summaryText:
        "Valutazione della comunicazione e dell'empatia clinica non disponibile per questa sessione.",
    };
  }

  let badgeLabel = "CURA RELAZIONALE ECCELLENTE";
  let severity: "success" | "warning" | "danger" | "info" = "success";

  if (relationalAudit.overallVerdict === "SATISFACTORY_RELATIONAL_CARE") {
    badgeLabel = "CURA RELAZIONALE ADEGUATA";
    severity = "success";
  } else if (relationalAudit.overallVerdict === "MECHANICAL_TRANSACTIONAL") {
    badgeLabel = "APPROCCIO MECCANICO / TRANSAZIONALE";
    severity = "warning";
  } else if (relationalAudit.overallVerdict === "RELATIONAL_FAIL_OR_IATROGENIC_DISTRESS") {
    badgeLabel = "FALLIMENTO RELAZIONALE / CRITICITÀ EMPATICA";
    severity = "danger";
  }

  return {
    isEvaluated: true,
    verdictBadge: {
      code: relationalAudit.overallVerdict,
      label: badgeLabel,
      severity,
    },
    empathyPercentage: relationalAudit.careEmpathyScore,
    riasMetrics: relationalAudit.riasMetrics,
    careMeasureChecklist: relationalAudit.careMeasureChecklist,
    criticalFlaws: relationalAudit.criticalRelationalFlaws.map((flaw) => ({
      doctorUtteranceOrOmission: flaw.doctorUtteranceOrOmission,
      psychologicalImpact: flaw.psychologicalImpact,
      riasViolationType: flaw.riasViolationType,
      suggestedAlternative: flaw.suggestedEvidenceBasedAlternative,
    })),
    spikesProtocolCompliance: relationalAudit.spikesProtocolCompliance,
    summaryText: `Punteggio di empatia e comunicazione clinica (CARE Measure / RIAS): ${relationalAudit.careEmpathyScore}%.`,
  };
}
