import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "../../../../lib/prisma";
import { getSessionUserId } from "../../../../lib/api-session";
import { isDevAuthBypass } from "../../../../lib/require-user";
import { getCaseById, decodeCaseParam, normalizeCaseLookupKey } from "@/lib/data/cases/registry";
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
import { OfflineResultsGate } from "./OfflineResultsGate";

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
  killerSwitch?: KillerSwitchTrace;
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

    const sessionId = resolvedSearch?.sessionId?.trim() || "";
    const caseId = decodeCaseParam(resolvedParams.id);
    const registered = await getCaseById(caseId);
    const caseKey = normalizeCaseLookupKey(caseId);

    const userId = await getSessionUserId();

    let session: Awaited<ReturnType<typeof prisma.sessionReport.findUnique>> | null = null;
    if (sessionId && !sessionId.startsWith("local-")) {
      try {
        session = await prisma.sessionReport.findUnique({
          where: { id: sessionId },
        });
      } catch (err) {
        console.error("[CaseResultsPage] Prisma SessionReport lookup failed — using local fallback", err);
        session = null;
      }
    }

    const caseMatches =
      Boolean(session) &&
      normalizeCaseLookupKey(session!.caseId) === caseKey;

    const ownerOk =
      Boolean(session) && (isDevAuthBypass() || !userId || session!.userId === userId);

    if (!session || !caseMatches || !ownerOk) {
      if (!registered && !sessionId) {
        return notFound();
      }
      return (
        <div className="min-h-screen bg-[#EEF1F5] text-slate-800">
          <div
            className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(52,88,132,0.11),transparent_42%),radial-gradient(ellipse_at_bottom_right,rgba(30,50,78,0.08),transparent_40%)]"
            aria-hidden
          />
          <div className="relative mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
            <div className="mb-5 flex items-center justify-between gap-3">
              <Link
                href="/dashboard/prassi"
                className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm ring-1 ring-slate-200/80 transition hover:text-[#345884]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Casi Clinici
              </Link>
              <Link href="/dashboard" aria-label="Vai alla dashboard">
                <AequanLogo height={28} />
              </Link>
            </div>
            <OfflineResultsGate
              caseId={caseId}
              sessionId={sessionId}
              correctSolution={registered?.correctSolution}
              legalSources={registered?.legalConformity.ragReferences.map((r) => r.sourceRef)}
            />
          </div>
        </div>
      );
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
        metric: "Comunicazione",
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
      <div className="min-h-screen bg-[#EEF1F5] text-slate-800">
        <div
          className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(52,88,132,0.11),transparent_42%),radial-gradient(ellipse_at_bottom_right,rgba(30,50,78,0.08),transparent_40%)]"
          aria-hidden
        />
        <div className="relative mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="mb-5 flex items-center justify-between gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm ring-1 ring-slate-200/80 transition hover:text-[#345884]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Dashboard
            </Link>
            <Link href="/dashboard" aria-label="Vai alla dashboard">
              <AequanLogo height={28} />
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
