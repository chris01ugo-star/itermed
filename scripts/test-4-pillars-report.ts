import { mapClinicalAuditToDTO } from "@/lib/mappers/clinical-audit-mapper";
import { mapEconomicAuditToDTO } from "@/lib/mappers/economic-audit-mapper";
import { mapLegalAuditToDTO } from "@/lib/mappers/legal-audit-mapper";
import { mapRelationalAuditToDTO } from "@/lib/mappers/relational-audit-mapper";

async function runLocalReportTest() {
  console.log("----------------------------------------------------");
  console.log("🧪 VERIFICA LOCALE 4 PILASTRI REPORT SIMULAZIONE");
  console.log("----------------------------------------------------");

  // Dati Mock per simulare un rawTrace completo proveniente da SessionReport
  const mockRawTrace = {
    legalAudit: {
      status: "EVALUATED",
      overallVerdict: "FULLY_PROTECTED",
      complianceScore: 95,
      compliantActions: [
        {
          performedAction: "Somministrazione di Aspirina 300mg",
          supportingGuidelineRef: "Linee Guida ESC 2023 - Art. 4",
          chunkId: "chk_123",
        },
      ],
      legalOmissionsOrRisks: [],
      uncoveredAreas: [],
    },
    economicAudit: {
      status: "EVALUATED",
      overallVerdict: "OPTIMAL_EFFICIENCY",
      efficiencyScore: 100,
      financialSummary: {
        totalSpentEuro: 120.5,
        idealCostEuro: 120.5,
        deltaEuro: 0,
        inappropriateSpendEuro: 0,
      },
      inappropriateExams: [],
      omittedEssentialExams: [],
      appropriateExamsCount: 3,
    },
    clinicalAudit: {
      status: "EVALUATED",
      overallVerdict: "EXCELLENT_MANAGEMENT",
      clinicalAccuracyScore: 100,
      diagnosticMatch: {
        userDiagnosis: "Sindrome Coronarica Acuta (NSTEMI)",
        goldDiagnosis: "Sindrome Coronarica Acuta (NSTEMI)",
        isCorrect: true,
        diagnosticAccuracyDescription: "Diagnosi perfetta e allineata al Gold Path.",
      },
      therapeuticCompliance: {
        correctInterventions: [
          { actionName: "ECG a 12 derivazioni", guidelineRef: "Protocollo Urgenza" },
        ],
        omittedEssentialInterventions: [],
        contraindicatedOrIatrogenicActions: [],
      },
      timeCriticalCompliance: {
        wereTimeLimitsRespected: true,
        delayNotes: [],
      },
    },
    relationalAudit: {
      status: "EVALUATED",
      overallVerdict: "EXCELLENT_RELATIONAL_CARE",
      careEmpathyScore: 90,
      riasMetrics: {
        empathyValidationCount: 3,
        jargonWithoutExplanationCount: 0,
        activeListeningScore: 95,
        sharedDecisionMakingScore: 85,
      },
      careMeasureChecklist: [
        {
          dimension: "Listening",
          observed: true,
          evidenceUtterance: "La ascolto, mi dica pure.",
          clinicalImpactNote: "Ottima accoglienza",
        },
      ],
      criticalRelationalFlaws: [],
      spikesProtocolCompliance: {
        isApplicable: false,
        adherenceScorePercentage: 100,
        missedSteps: [],
      },
    },
  };

  const legalDTO = mapLegalAuditToDTO(mockRawTrace.legalAudit as any);
  const economicDTO = mapEconomicAuditToDTO(mockRawTrace.economicAudit as any);
  const clinicalDTO = mapClinicalAuditToDTO(mockRawTrace.clinicalAudit as any);
  const relationalDTO = mapRelationalAuditToDTO(mockRawTrace.relationalAudit as any);

  console.log("✅ 1. TUTELA LEGALE (L. 24/2017):", JSON.stringify(legalDTO, null, 2));
  console.log("✅ 2. APPROPRIATEZZA ECONOMICA (SSN):", JSON.stringify(economicDTO, null, 2));
  console.log("✅ 3. ACCURATEZZA CLINICA (Gold Path):", JSON.stringify(clinicalDTO, null, 2));
  console.log("✅ 4. EMPATIA RELAZIONALE (RIAS/CARE):", JSON.stringify(relationalDTO, null, 2));

  console.log("\n----------------------------------------------------");
  console.log("🎉 TEST SCRIPT COMPLETATO CON SUCCESSO!");
  console.log("----------------------------------------------------");
}

runLocalReportTest().catch(console.error);
