import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "../../../../lib/prisma";
import { getSessionUserId } from "../../../../lib/api-session";
import { isDevAuthBypass } from "../../../../lib/require-user";
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
import { AequanLogo } from "@/components/AequanLogo";
import { EliteResultsClient } from "./EliteResultsClient";

type ResultsPageProps = {
  params: Promise<{ id: string }> | { id: string };
  searchParams: Promise<{ sessionId?: string }> | { sessionId?: string };
};

/** Trace shape persisted by simulation-report-worker → buildSessionReportData. */
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
  /** Deterministic Killer-Switch audit trail (preferred source). */
  killerSwitch?: KillerSwitchTrace;
  /** Top-level fatal errors from detectFatalErrors (description + rationale). */
  fatalErrors?: FatalError[];
  empathyBreakdown?: EmpathyBehavioralBreakdown | null;
  scoreBreakdown?: ScoreBreakdown | null;
};

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

function safeNum(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export default async function CaseResultsPage({ params, searchParams }: ResultsPageProps) {
  try {
    const resolvedParams = "then" in params ? await params : params;
    const resolvedSearch =
      searchParams && "then" in searchParams ? await searchParams : searchParams;

    const sessionId = resolvedSearch?.sessionId;
    const caseId = resolvedParams.id;

    if (!sessionId) {
      return notFound();
    }

    const userId = await getSessionUserId();
    if (!userId) {
      return notFound();
    }

    const session = await prisma.sessionReport.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.caseId !== caseId) {
      return notFound();
    }

    if (!isDevAuthBypass() && session.userId !== userId) {
      return notFound();
    }

    const trace = (session.rawTrace ?? {}) as SessionTrace;

    const killerSwitch = trace.killerSwitch;
    const fatalErrors = normalizeFatalErrorsForUi(
      trace.fatalErrors ?? trace.analytical?.fatalErrors,
    );

    const radarData = [
      {
        metric: "Accuratezza clinica",
        key: "clinicalAccuracy",
        score: safeNum(session.clinicalAccuracy),
      },
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
      {
        metric: "Empatia",
        key: "empathy",
        score: safeNum(session.empathy),
      },
    ];

    const legalProtectionStatus = trace.analytical?.legalProtectionStatus ?? null;
    const economicAnalysis = trace.analytical?.economicAnalysis ?? null;
    const clinicalDeltaTable = Array.isArray(trace.analytical?.clinicalDeltaTable)
      ? trace.analytical!.clinicalDeltaTable!
      : [];

    return (
      <div className="min-h-screen bg-[#F4F6F8] text-text-primary">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 md:px-8 md:py-10">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-panel-bg px-3.5 py-2 text-xs font-medium text-brand-primary shadow-aequan-panel transition hover:border-brand-secondary/30 hover:bg-brand-secondary/[0.04] aequan-interactive"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Dashboard
            </Link>
            <Link href="/dashboard" aria-label="Vai alla dashboard" className="hidden sm:block">
              <AequanLogo height={32} />
            </Link>
          </div>

          <EliteResultsClient
            totalScore={safeNum(session.totalScore)}
            radarData={radarData}
            dismissed={Boolean(trace.dismissed)}
            strengths={
              Array.isArray(trace.feedback?.strengths) ? trace.feedback!.strengths! : []
            }
            weaknesses={
              Array.isArray(trace.feedback?.weaknesses) ? trace.feedback!.weaknesses! : []
            }
            correctSolution={trace.feedback?.correctSolution}
            legalProtectionStatus={legalProtectionStatus ?? undefined}
            clinicalDeltaTable={clinicalDeltaTable}
            economicAnalysis={economicAnalysis ?? undefined}
            coachingFeedback={trace.analytical?.coachingFeedback}
            legalSources={
              Array.isArray(trace.evidence?.legalSources) ? trace.evidence!.legalSources! : []
            }
            killerSwitch={killerSwitch}
            fatalErrors={fatalErrors}
            empathyBreakdown={trace.empathyBreakdown ?? trace.scoreBreakdown?.empathy ?? null}
            scoreBreakdown={trace.scoreBreakdown ?? null}
          />
        </div>
      </div>
    );
  } catch (err) {
    console.error("[CaseResultsPage] Server-side exception while rendering report:", err);
    throw err;
  }
}
