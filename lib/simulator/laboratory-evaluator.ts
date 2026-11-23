import { generateObject } from "ai";
import { MODEL_GPT_6_LUNA, openAIObjectCall } from "@/lib/ai/models";
import { asOpenAIStrictSchema } from "@/lib/ai/strict-schema";
import type { Logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import type { ClinicalAuditResult } from "@/lib/services/clinical-audit-service";
import type { EconomicAuditResult } from "@/lib/services/economic-audit-service";
import type { EvaluationResult, ExamPayload } from "@/lib/services/evaluation-service";
import type { LegalAuditResult } from "@/lib/services/legal-audit-service";
import { ragService, type GuidelineRetrievalSection, type RelevantGuidelines } from "@/lib/services/rag-service";
import type { RelationalAuditResult } from "@/lib/services/relational-audit-service";
import { buildSessionReportData, type ClinicalCaseSnapshot } from "@/lib/services/simulation-report-data";
import type { RagPillarTrace } from "@/lib/reports/pillar-radar";
import { formatLabInterprofessionalLog, labelLabLogEntry } from "@/lib/simulator/laboratory-interprofessional";
import { isLaboratoryCase } from "@/lib/simulator/laboratory-lis";
import {
  deterministicCommunicationScore,
  gradeLaboratorySession,
  type LabSessionGrade,
  type LabWaterfallStep,
} from "@/lib/simulator/laboratory-scoring";
import { loadStoredLabBlueprint } from "@/lib/simulator/load-lab-flow";
import {
  extractLabBlueprintV2,
  parseLabWorkbenchState,
  type LabCaseBlueprint,
  type LabWorkbenchState,
} from "@/lib/simulator/laboratory-workbench";
import { z } from "zod";

const LabNarrativeSchema = z.object({
  clinicalFeedback: z.string().min(1).max(900),
  legalFeedback: z.string().min(1).max(900),
  economicFeedback: z.string().min(1).max(700),
  communicationFeedback: z.string().min(1).max(700),
  qualitativeCommunicationScore: z.number().min(0).max(100),
  citations: z.array(z.string().min(1).max(240)).max(6),
});

type LabNarrative = z.infer<typeof LabNarrativeSchema> & { source: "llm" | "fallback" };

const SPECIALTY = "Medicina di Laboratorio";

function emptySection(): GuidelineRetrievalSection {
  return {
    chunks: [],
    sources: [],
    combinedText: "",
    source: "none",
    hasContext: false,
    ragSourcesCount: 0,
  };
}

function emptyGuidelines(query: string): RelevantGuidelines {
  return {
    query,
    legal: emptySection(),
    protocol: emptySection(),
    economic: emptySection(),
    hasLegalContext: false,
    hasProtocolContext: false,
    hasEconomicContext: false,
  };
}

function isMissingLabColumn(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /labWorkbenchState/i.test(message);
}

function clip(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max - 1).trim();
}

function stepsText(steps: LabWaterfallStep[]): string {
  const body = steps
    .filter((step) => step.kind !== "final")
    .map((step) => `${step.label}: ${step.detail}`)
    .join(" ");
  return body || "Nessuno scostamento rispetto al blueprint del banco.";
}

function sourceTitles(guidelines: RelevantGuidelines): string[] {
  return [...guidelines.protocol.sources, ...guidelines.legal.sources, ...guidelines.economic.sources]
    .map((title) => title.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function searchQuery(blueprint: LabCaseBlueprint): string {
  const topics = blueprint.evaluation.ragTopics ?? [];
  return [
    blueprint.clinicalOrderSummary,
    ...blueprint.analytes.map((analyte) => analyte.name),
    ...blueprint.analytes.map((analyte) => analyte.expectedReasonCode ?? ""),
    ...blueprint.reflexCatalog.map((reflex) => reflex.name),
    ...topics,
    "SIBioC",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 1500);
}

async function retrieveLabGuidelines(
  blueprint: LabCaseBlueprint,
  log: Logger,
): Promise<RelevantGuidelines> {
  const query = searchQuery(blueprint);
  try {
    return await ragService.getRelevantGuidelines({
      finalDiagnosis: blueprint.clinicalOrderSummary.slice(0, 240),
      caseContext: query,
      reportText: "",
      tags: (blueprint.evaluation.ragTopics ?? blueprint.analytes.map((analyte) => analyte.name)).slice(0, 8),
      specialtyName: SPECIALTY,
    });
  } catch (error) {
    log.warn("Laboratory RAG retrieval failed — evaluator continues without excerpts", { error });
    return emptyGuidelines(query);
  }
}

async function narrateLabSession(input: {
  blueprint: LabCaseBlueprint;
  state: LabWorkbenchState;
  guidelines: RelevantGuidelines;
  log: Logger;
}): Promise<LabNarrative> {
  const fallbackScore = deterministicCommunicationScore(input.blueprint, input.state);
  const titles = sourceTitles(input.guidelines);
  const fallback = (): LabNarrative => ({
    source: "fallback",
    clinicalFeedback: "Valutazione deterministica del banco: disposizioni e indagini rispetto al blueprint.",
    legalFeedback: "Valutazione deterministica della notifica critica, del read-back e dello SLA.",
    economicFeedback: "Valutazione deterministica della spesa reflex rispetto al budget SSN.",
    communicationFeedback: "Valutazione deterministica della nota di validazione e del dialogo interprofessionale.",
    qualitativeCommunicationScore: fallbackScore,
    citations: titles,
  });

  const excerpts = [
    input.guidelines.protocol.combinedText,
    input.guidelines.legal.combinedText,
    input.guidelines.economic.combinedText,
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 6000);

  const rubric = {
    order: input.blueprint.clinicalOrderSummary,
    concepts: input.blueprint.evaluation.expectedValidationNoteConcepts,
    analytes: input.blueprint.analytes.map((analyte) => ({
      name: analyte.name,
      expected: analyte.expectedDisposition,
      reason: analyte.expectedReasonCode ?? null,
      chosen: input.state.dispositions[analyte.id]?.action ?? null,
      chosenReason: input.state.dispositions[analyte.id]?.reasonCode ?? null,
    })),
    notification: input.state.criticalNotification ?? null,
    criticalRequired: input.blueprint.criticalValuePolicy.required,
    note: input.state.validationNote.slice(0, 2500),
    log: formatLabInterprofessionalLog(input.state.interprofessionalLog),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const result = await generateObject({
      ...openAIObjectCall(MODEL_GPT_6_LUNA),
      schema: asOpenAIStrictSchema(LabNarrativeSchema),
      abortSignal: controller.signal,
      maxRetries: 0,
      system: `Sei l'esaminatore del banco di Medicina di Laboratorio. Una sola valutazione, in italiano.
Usa solo gli estratti forniti (SIBioC, legge 219, nomenclatore). Se un estratto non c'è, non inventare la citazione.
Valuta la nota di validazione e il dialogo. Nel log, «Patologo → TSLB» è il banco e «Patologo → Medico richiedente» è il medico di reparto o del PS. Non valutare visita, farmaci, stress del paziente o diario di dimissione.
qualitativeCommunicationScore è 0-100 sulla chiarezza della nota e del read-back.`,
      prompt: [
        excerpts ? `ESTRATTI\n${excerpts}` : "ESTRATTI\nNessun estratto recuperato.",
        `RUBRICA\n${JSON.stringify(rubric)}`,
      ].join("\n\n"),
    });
    return { ...result.object, source: "llm" };
  } catch (error) {
    input.log.warn("Laboratory evaluator fallback", { error });
    return fallback();
  } finally {
    clearTimeout(timer);
  }
}

function examsFromState(blueprint: LabCaseBlueprint, state: LabWorkbenchState): ExamPayload[] {
  return state.requestedReflexIds.map((order) => {
    const reflex = blueprint.reflexCatalog.find((item) => item.id === order.id);
    return {
      id: order.id,
      name: reflex?.name ?? order.id,
      cost: order.costEuro,
      timeMinutes: 0,
    };
  });
}

function toEvaluation(input: {
  blueprint: LabCaseBlueprint;
  state: LabWorkbenchState;
  grade: LabSessionGrade;
  narrative: LabNarrative;
  guidelines: RelevantGuidelines;
}): EvaluationResult {
  const { blueprint, state, grade, narrative } = input;
  const clinicalFeedback =
    narrative.source === "fallback" ? stepsText(grade.waterfall.clinical) : narrative.clinicalFeedback;
  const legalFeedback =
    narrative.source === "fallback" ? stepsText(grade.waterfall.legal) : narrative.legalFeedback;
  const economicFeedback =
    narrative.source === "fallback" ? stepsText(grade.waterfall.economy) : narrative.economicFeedback;
  const communicationFeedback =
    narrative.source === "fallback"
      ? stepsText(grade.waterfall.empathy)
      : narrative.communicationFeedback;
  const exams = examsFromState(blueprint, state);
  return {
    criticalActions: blueprint.analytes.map((analyte) => ({
      description: `${analyte.name}: ${analyte.expectedDisposition}`,
      performed: state.dispositions[analyte.id]?.action === analyte.expectedDisposition,
      criticalLevel: analyte.flag.startsWith("CRITICAL") ? "HIGH" : "MEDIUM",
      feedback: analyte.expectedReasonCode ?? analyte.expectedDisposition,
      evidenceCitation: "Blueprint LIS v2",
    })),
    inappropriateActions: blueprint.reflexCatalog
      .filter((reflex) => reflex.expectedAction === "INAPPROPRIATE")
      .map((reflex) => ({
        description: reflex.name,
        performed: state.requestedReflexIds.some((order) => order.id === reflex.id),
        penaltyWeight: reflex.costEuro,
        feedback: reflex.clinicalRationale,
        evidenceCitation: "Catalogo reflex",
      })),
    empathyChecklist: [
      {
        parameter: "Nota di validazione",
        met: state.validationNote.trim().length >= 25,
        feedback: communicationFeedback,
      },
    ],
    feedback: {
      strengths: grade.firedKillers.length === 0 ? ["Nessun killer switch del banco."] : [],
      weaknesses: grade.firedKillers.map((rule) => rule.label),
      clinicalNote: clinicalFeedback,
      prescribingNote: economicFeedback,
      empathyNote: communicationFeedback,
      economyNote: economicFeedback,
      correctSolution: blueprint.evaluation.expectedValidationNoteConcepts.join("; "),
    },
    evidence: {
      legalSources: narrative.citations,
      protocolSources: sourceTitles(input.guidelines),
    },
    clinicalDeltaTable: blueprint.analytes.map((analyte) => {
      const chosen = state.dispositions[analyte.id]?.action;
      return {
        protocolAction: `${analyte.name} ${analyte.expectedDisposition}`,
        userAction: chosen ?? "nessuna disposizione",
        status: chosen === analyte.expectedDisposition ? "MET" : "MISSED",
        penaltyOrBonusReason: analyte.expectedReasonCode ?? "Disposizione di banco",
        evidenceCitation: "Blueprint LIS v2",
      };
    }),
    economicAnalysis: {
      targetBudget: blueprint.budgetEuro,
      actualSpent: grade.reflexSpendEuro,
      unnecessaryExpenses: blueprint.reflexCatalog
        .filter(
          (reflex) =>
            reflex.expectedAction === "INAPPROPRIATE" &&
            state.requestedReflexIds.some((order) => order.id === reflex.id),
        )
        .map((reflex) => ({
          examName: reflex.name,
          cost: reflex.costEuro,
          reason: reflex.clinicalRationale,
          evidenceCitation: "Catalogo reflex",
        })),
      missedRequiredExams: blueprint.reflexCatalog
        .filter(
          (reflex) =>
            reflex.expectedAction === "MANDATORY" &&
            !state.requestedReflexIds.some((order) => order.id === reflex.id),
        )
        .map((reflex) => ({
          examName: reflex.name,
          cost: reflex.costEuro,
          reason: "Reflex obbligatorio non richiesto.",
          evidenceCitation: "Catalogo reflex",
        })),
    },
    coachingFeedback: {
      empatia: communicationFeedback,
      tutelaLegale: legalFeedback,
      economicita: economicFeedback,
      accuratezza: clinicalFeedback,
    },
    neurologicalRedFlagDetected: false,
    fatalErrors: grade.fatalErrors,
    scores: grade.scores,
    scoreBreakdown: {
      clinical: {
        base: grade.scores.clinical,
        missedHigh: 0,
        missedMedium: 0,
        penaltyHigh: 0,
        penaltyMedium: 0,
        final: grade.scores.clinical,
        motivations: [],
        elapsedMinutes: state.criticalNotification?.elapsedMinutes,
        timeMalusFraction: 0,
        criticalTimeDelay: false,
        failedDiagnosisCount: 0,
        diagnosisPenalty: 0,
        iatrogenicCritical: false,
      },
      exams: {
        base: grade.scores.exams,
        penaltySum: 0,
        performedInappropriateCount: grade.inappropriateSpendEuro > 0 ? 1 : 0,
        final: grade.scores.exams,
        motivations: [],
      },
      economy: {
        budgetEuro: blueprint.budgetEuro,
        totalCostEuro: grade.reflexSpendEuro,
        examSpendEuro: grade.reflexSpendEuro,
        formula: "Spesa reflex rispetto al budget del ticket.",
        final: grade.scores.economy,
        motivations: [],
        idealSpendEuro: blueprint.budgetEuro,
        deltaSpendEuro: Math.round((grade.reflexSpendEuro - blueprint.budgetEuro) * 100) / 100,
      },
      legal: {
        applicableInstruments: 1,
        violated: grade.scores.legal >= 60 ? 0 : 1,
        partial: 0,
        weightPerInstrument: 100,
        final: grade.scores.legal,
        motivations: [],
        conformityStatus: grade.scores.legal >= 60 ? "CONFORME" : "NON_CONFORME",
        expertAnalysis: legalFeedback,
      },
      empathy: {
        baseline: 0,
        validationBonus: 0,
        transparencyBonus: 0,
        allianceBonus: 0,
        dismissalPenalty: 0,
        finalScore: grade.scores.empathy,
        final: grade.scores.empathy,
        qualitativeLabel: communicationFeedback.slice(0, 180),
        motivations: [],
        finalStressLevel: null,
        stressPenalty: 0,
        criticalPatientStress: false,
      },
      communication: {
        finalStressLevel: null,
        stressPenalty: 0,
        criticalPatientStress: false,
        final: grade.scores.empathy,
      },
    },
    resolvedExams: exams,
    examBudgetEuro: blueprint.budgetEuro,
    totalExamCostEuro: grade.reflexSpendEuro,
  };
}

function legalAudit(score: number, feedback: string, citations: string[]): LegalAuditResult {
  const verdict =
    score >= 85 ? "FULLY_PROTECTED" : score >= 60 ? "PARTIALLY_PROTECTED" : "LEGAL_RISK_EXPOSED";
  return {
    status: "EVALUATED",
    overallVerdict: verdict,
    complianceScore: score,
    executiveSummary: clip(feedback, 600),
    comparativeAnalysis: [
      {
        userAction: clip(feedback, 400),
        requiredAction: "Notifica sincrona con read-back quando la policy del critico lo richiede.",
        isProtected: score >= 85,
        explanation: clip(feedback, 600),
        sourceQuote: citations[0] ?? "",
        faultCategory: score >= 85 ? "OTTIMALE" : score >= 60 ? "IMPERIZIA_LIEVE" : "NEGLIGENZA_GRAVE",
      },
    ],
    uncoveredAreas: [],
    guidelineCitations: citations.slice(0, 8),
  };
}

function economicAudit(
  blueprint: LabCaseBlueprint,
  state: LabWorkbenchState,
  grade: LabSessionGrade,
  feedback: string,
): EconomicAuditResult {
  const verdict =
    grade.scores.economy >= 85
      ? "OPTIMAL_EFFICIENCY"
      : grade.scores.economy >= 60
        ? "MODERATE_OVERTESTING"
        : grade.scores.economy >= 30
          ? "SEVERE_OVERTESTING"
          : "CRITICAL_UNDERTESTING";
  const inappropriate = blueprint.reflexCatalog.filter(
    (reflex) =>
      reflex.expectedAction === "INAPPROPRIATE" &&
      state.requestedReflexIds.some((order) => order.id === reflex.id),
  );
  const omitted = blueprint.reflexCatalog.filter(
    (reflex) =>
      reflex.expectedAction === "MANDATORY" &&
      !state.requestedReflexIds.some((order) => order.id === reflex.id),
  );
  return {
    status: "EVALUATED",
    overallVerdict: verdict,
    efficiencyScore: grade.scores.economy,
    executiveSummary: clip(feedback, 600),
    financialSummary: {
      totalSpentEuro: grade.reflexSpendEuro,
      idealCostEuro: blueprint.budgetEuro,
      deltaEuro: Math.round((grade.reflexSpendEuro - blueprint.budgetEuro) * 100) / 100,
      inappropriateSpendEuro: grade.inappropriateSpendEuro,
    },
    inappropriateExams: inappropriate.map((reflex) => ({
      examId: reflex.id,
      examName: reflex.name,
      costEuro: reflex.costEuro,
      reasonForInappropriateness: reflex.clinicalRationale,
    })),
    omittedEssentialExams: omitted.map((reflex) => ({
      examId: reflex.id,
      examName: reflex.name,
      costEuro: reflex.costEuro,
      clinicalImpactOfOmission: "Reflex obbligatorio non eseguito.",
    })),
    appropriateExamsCount: blueprint.reflexCatalog.filter(
      (reflex) =>
        reflex.expectedAction === "MANDATORY" &&
        state.requestedReflexIds.some((order) => order.id === reflex.id),
    ).length,
  };
}

function clinicalAudit(grade: LabSessionGrade, feedback: string, concepts: string[]): ClinicalAuditResult {
  const score = grade.scores.clinical;
  const verdict =
    score >= 85
      ? "EXCELLENT_MANAGEMENT"
      : score >= 70
        ? "SATISFACTORY_MANAGEMENT"
        : score >= 40
          ? "SUBOPTIMAL_MANAGEMENT"
          : "CRITICAL_CLINICAL_ERROR";
  return {
    status: "EVALUATED",
    overallVerdict: verdict,
    clinicalAccuracyScore: score,
    executiveSummary: clip(feedback, 600),
    diagnosticMatch: {
      userDiagnosis: clip(feedback, 400),
      goldDiagnosis: concepts.join("; "),
      isCorrect: score >= 80,
      diagnosticAccuracyDescription: clip(feedback, 600),
    },
    therapeuticCompliance: {
      correctInterventions: [],
      omittedEssentialInterventions: [],
      contraindicatedOrIatrogenicActions: grade.firedKillers.map((rule) => ({
        actionName: rule.label,
        riskDescription: `Tetto ${rule.maxScoreCap}/30.`,
        isCriticalIatrogenic: true,
      })),
    },
    timeCriticalCompliance: {
      wereTimeLimitsRespected: true,
      delayNotes: [],
    },
  };
}

function relationalAudit(score: number): RelationalAuditResult {
  const verdict =
    score >= 85
      ? "EXCELLENT_RELATIONAL_CARE"
      : score >= 60
        ? "SATISFACTORY_RELATIONAL_CARE"
        : score >= 40
          ? "MECHANICAL_TRANSACTIONAL"
          : "RELATIONAL_FAIL_OR_IATROGENIC_DISTRESS";
  return {
    status: "EVALUATED",
    overallVerdict: verdict,
    careEmpathyScore: score,
    riasMetrics: {
      empathyValidationCount: 0,
      jargonWithoutExplanationCount: 0,
      activeListeningScore: score,
      sharedDecisionMakingScore: score,
    },
    careMeasureChecklist: [],
    criticalRelationalFlaws: [],
    spikesProtocolCompliance: {
      isApplicable: false,
      adherenceScorePercentage: score,
      missedSteps: [],
    },
  };
}

export async function persistLaboratoryWorkbenchReportIfReady(
  input: {
    reportId: string;
    userId: string;
    caseId: string;
    liveSessionId?: string;
  },
  log: Logger,
): Promise<boolean> {
  if (!input.liveSessionId) return false;

  let session: Awaited<ReturnType<typeof loadLabSession>> | undefined;
  try {
    session = await loadLabSession(input.liveSessionId);
  } catch (error) {
    if (isMissingLabColumn(error)) {
      log.warn("labWorkbenchState column absent — clinical report pipeline unchanged", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
    throw error;
  }
  if (!session?.case) return false;

  const state = parseLabWorkbenchState(session.labWorkbenchState);
  if (!state) return false;

  const specialty = session.case.medicalSpecialty?.name || session.case.specialty || "";
  if (!isLaboratoryCase({ id: input.caseId, specialty })) return false;

  const blueprint =
    (await loadStoredLabBlueprint(input.caseId)) ??
    extractLabBlueprintV2(session.case.baselineExamFindings);
  if (!blueprint) {
    throw new Error("Sessione di banco laboratorio senza blueprint v2.");
  }

  await prisma.sessionReport.update({
    where: { id: input.reportId },
    data: { progress: 46, progressMessage: "Lettura del banco di laboratorio..." },
  });

  const guidelines = await retrieveLabGuidelines(blueprint, log);
  const narrative = await narrateLabSession({ blueprint, state, guidelines, log });
  const grade = gradeLaboratorySession({
    blueprint,
    state,
    qualitativeCommunicationScore: narrative.qualitativeCommunicationScore,
  });
  const evaluation = toEvaluation({ blueprint, state, grade, narrative, guidelines });
  const citations = narrative.citations.length > 0 ? narrative.citations : sourceTitles(guidelines);
  const ragPillars: RagPillarTrace = {
    authoritative: false,
    isLab: true,
    retrievedQuery: guidelines.query,
    sourceTitles: citations,
    clinica: { score: grade.scores.clinical, feedback: evaluation.feedback.clinicalNote },
    economia: { score: grade.scores.economy, feedback: evaluation.feedback.economyNote },
    legale: { score: grade.scores.legal, feedback: evaluation.coachingFeedback.tutelaLegale },
    empatia: { score: grade.scores.empathy, feedback: evaluation.feedback.empathyNote },
  };
  const clinicalCase: ClinicalCaseSnapshot = {
    difficulty: session.case.difficulty,
    medicalSpecialtyId: session.case.medicalSpecialtyId,
    specialty: session.case.specialty,
    medicalSpecialty: session.case.medicalSpecialty,
    baselineExamFindings: session.case.baselineExamFindings,
  };

  await prisma.sessionReport.update({
    where: { id: input.reportId },
    data: buildSessionReportData({
      userId: input.userId,
      caseId: input.caseId,
      clinicalCase,
      evaluationChatHistory: state.interprofessionalLog.map((row) => ({
        role: row.role === "user" ? "user" : "assistant",
        content: labelLabLogEntry(row),
      })),
      exams: evaluation.resolvedExams,
      normalizedReportText: state.validationNote,
      clinicalSummary: state.validationNote,
      evaluation,
      guidelines,
      totalScore: grade.totalTrentesimi,
      completedAt: new Date(),
      simulationElapsedMinutes: state.criticalNotification?.elapsedMinutes ?? session.elapsedMinutes,
      fatalErrors: grade.fatalErrors,
      killerSwitch: {
        applied: grade.killerSwitchApplied,
        rawTotalTrentesimi: grade.rawTrentesimi,
        finalTotalTrentesimi: grade.totalTrentesimi,
        cap: grade.killerCap ?? 17,
      },
      failedByCap: false,
      blockingFails: [],
      legalAudit: legalAudit(grade.scores.legal, evaluation.coachingFeedback.tutelaLegale, citations),
      economicAudit: economicAudit(
        blueprint,
        state,
        grade,
        evaluation.feedback.economyNote,
      ),
      clinicalAudit: clinicalAudit(
        grade,
        evaluation.feedback.clinicalNote,
        blueprint.evaluation.expectedValidationNoteConcepts,
      ),
      relationalAudit: relationalAudit(grade.scores.empathy),
      ragPillars,
      scoreProvenance: {
        scoreWaterfall: grade.waterfall,
        clinicalMatrix: null,
        guidelineEvidence: citations.map((text) => ({
          pillar: "legale",
          text,
          sources: citations,
        })),
        unifiedTrace: null,
        helpTelemetry: {
          helpRequested: false,
          helpRequestCount: 0,
          note: "Banco LIS v2: il voto non usa stress, diario di dimissione o esame obiettivo.",
        },
      },
    }),
  });

  log.info("Laboratory workbench report completed", {
    source: narrative.source,
    totalTrentesimi: grade.totalTrentesimi,
    rawTrentesimi: grade.rawTrentesimi,
    killerSwitchApplied: grade.killerSwitchApplied,
  });
  return true;
}

function loadLabSession(sessionId: string) {
  return prisma.caseSession.findUnique({
    where: { id: sessionId },
    select: {
      caseId: true,
      elapsedMinutes: true,
      labWorkbenchState: true,
      case: {
        select: {
          specialty: true,
          difficulty: true,
          medicalSpecialtyId: true,
          baselineExamFindings: true,
          medicalSpecialty: { select: { id: true, name: true } },
        },
      },
    },
  });
}
