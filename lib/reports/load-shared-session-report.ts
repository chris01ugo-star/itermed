import "server-only";

import { prisma } from "@/lib/prisma";
import { getCaseById, normalizeCaseLookupKey } from "@/lib/data/cases/registry";
import type {
  ClinicalDeltaRow,
  CoachingFeedback,
  EconomicAnalysis,
  FatalError,
  LegalProtectionStatus,
} from "@/lib/services/evaluation-report-types";
import type { KillerSwitchTrace } from "@/lib/services/simulation-report-data";
import type {
  EmpathyBehavioralBreakdown,
  ScoreBreakdown,
} from "@/lib/services/evaluation-scoring";

type SessionTrace = {
  feedback?: {
    strengths?: string[];
    weaknesses?: string[];
    correctSolution?: string;
  };
  dismissed?: boolean;
  evidence?: { legalSources?: string[] };
  analytical?: {
    legalProtectionStatus?: LegalProtectionStatus;
    clinicalDeltaTable?: ClinicalDeltaRow[];
    economicAnalysis?: EconomicAnalysis;
    coachingFeedback?: CoachingFeedback;
    fatalErrors?: FatalError[];
  };
  killerSwitch?: KillerSwitchTrace;
  fatalErrors?: FatalError[];
  empathyBreakdown?: EmpathyBehavioralBreakdown | null;
  scoreBreakdown?: ScoreBreakdown | null;
};

function safeNum(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeFatalErrorsForUi(
  errors: FatalError[] | undefined,
): Array<{ code: string; description: string }> {
  if (!Array.isArray(errors) || errors.length === 0) return [];
  return errors
    .filter((e) => typeof e?.description === "string" && e.description.trim().length > 0)
    .map((e, index) => ({
      code: `FATAL_${index + 1}`,
      description: e.description.trim(),
    }));
}

export type SharedEliteReport = {
  caseId: string;
  caseTitle: string | null;
  sessionId: string;
  totalScore: number;
  radarData: Array<{ metric: string; key: string; score: number }>;
  dismissed: boolean;
  strengths: string[];
  weaknesses: string[];
  correctSolution?: string;
  legalProtectionStatus?: LegalProtectionStatus;
  clinicalDeltaTable: ClinicalDeltaRow[];
  economicAnalysis?: EconomicAnalysis;
  coachingFeedback?: CoachingFeedback;
  legalSources: string[];
  killerSwitch?: KillerSwitchTrace;
  fatalErrors: Array<{ code: string; description: string }>;
  empathyBreakdown: EmpathyBehavioralBreakdown | null;
  scoreBreakdown: ScoreBreakdown | null;
};

export async function loadSharedSessionReport(
  sessionId: string,
): Promise<SharedEliteReport | null> {
  const id = sessionId.trim();
  if (!id || id.startsWith("local-")) return null;

  let session: Awaited<ReturnType<typeof prisma.sessionReport.findUnique>> | null = null;
  try {
    session = await prisma.sessionReport.findUnique({ where: { id } });
  } catch (err) {
    console.error("[loadSharedSessionReport] Prisma lookup failed", err);
    return null;
  }
  if (!session) return null;

  const registered = await getCaseById(session.caseId);
  const caseTitle =
    registered?.title ??
    (normalizeCaseLookupKey(session.caseId) ? session.caseId : null);
  const trace = (session.rawTrace ?? {}) as SessionTrace;

  return {
    caseId: session.caseId,
    caseTitle,
    sessionId: session.id,
    totalScore: safeNum(session.totalScore),
    radarData: [
      { metric: "Accuratezza clinica", key: "clinicalAccuracy", score: safeNum(session.clinicalAccuracy) },
      {
        metric: "Tutela medico-legale",
        key: "legalComplianceGelliBianco",
        score: safeNum(session.legalComplianceGelliBianco),
      },
      {
        metric: "Appropriatezza esami",
        key: "prescribingAppropriateness",
        score: safeNum(session.prescribingAppropriateness),
      },
      {
        metric: "Sostenibilità economica",
        key: "economicSustainability",
        score: safeNum(session.economicSustainability),
      },
      { metric: "Comunicazione", key: "empathy", score: safeNum(session.empathy) },
    ],
    dismissed: Boolean(trace.dismissed),
    strengths: Array.isArray(trace.feedback?.strengths) ? trace.feedback!.strengths! : [],
    weaknesses: Array.isArray(trace.feedback?.weaknesses) ? trace.feedback!.weaknesses! : [],
    correctSolution: trace.feedback?.correctSolution,
    legalProtectionStatus: trace.analytical?.legalProtectionStatus,
    clinicalDeltaTable: Array.isArray(trace.analytical?.clinicalDeltaTable)
      ? trace.analytical!.clinicalDeltaTable!
      : [],
    economicAnalysis: trace.analytical?.economicAnalysis,
    coachingFeedback: trace.analytical?.coachingFeedback,
    legalSources: Array.isArray(trace.evidence?.legalSources) ? trace.evidence!.legalSources! : [],
    killerSwitch: trace.killerSwitch,
    fatalErrors: normalizeFatalErrorsForUi(trace.fatalErrors ?? trace.analytical?.fatalErrors),
    empathyBreakdown: trace.empathyBreakdown ?? trace.scoreBreakdown?.empathy ?? null,
    scoreBreakdown: trace.scoreBreakdown ?? null,
  };
}
