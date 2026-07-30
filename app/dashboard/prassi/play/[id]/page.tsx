import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { userCanPlayCase } from "@/lib/access";
import { requireUser, isDevAuthBypass } from "@/lib/require-user";
import { SimulatorClient } from "@/components/simulator/SimulatorClient";
import { LiveAequanClinicalWorkspace } from "@/components/aequan/LiveAequanClinicalWorkspace";
import { getExamValuesCatalog, getCaseExamOverrides } from "@/lib/exam-values-service";
import { EXAM_DEFAULT_VALUES } from "@/lib/exam-default-values";

const FALLBACK_CASES: Record<
  string,
  {
    id: string;
    title: string;
    description: string;
    specialty: string | null;
    difficulty: string;
    estimatedDurationMinutes: number | null;
    patientPrompt: string;
  }
> = {
  cs_001: {
    id: "cs_001",
    title: "Dolore toracico in PS",
    description:
      "Dolore toracico acuto con sintomi associati. Focus su appropriatezza esami e sicurezza clinica.",
    specialty: "Emergenza",
    difficulty: "MEDIUM",
    estimatedDurationMinutes: 15,
    patientPrompt:
      "Paziente con dolore toracico acuto e dispnea. Rispondi da paziente ansioso, evita diagnosi e valori vitali a voce.",
  },
  cs_002: {
    id: "cs_002",
    title: "Febbre persistente in paziente anziano",
    description:
      "Febbre e astenia persistenti. Focus su raccolta anamnesi e tutela medico-legale nella documentazione.",
    specialty: "Medicina interna",
    difficulty: "EASY",
    estimatedDurationMinutes: 18,
    patientPrompt:
      "Paziente anziano con febbre persistente. Rispondi da paziente, non dare diagnosi, descrivi sintomi e preoccupazioni.",
  },
};

type PlayPageProps = {
  params: Promise<{ id: string }> | { id: string };
  searchParams?: Promise<{ sessionId?: string }> | { sessionId?: string };
};

type CaseNodeContent = { casePrompt?: string };
type CaseBaseline = {
  demographics?: { age?: number | string | null; sex?: string | null; context?: string | null };
};

export default async function PrassiPlayPage(props: PlayPageProps) {
  const params = "then" in props.params ? await props.params : props.params;
  const searchParams =
    props.searchParams && "then" in props.searchParams
      ? await props.searchParams
      : props.searchParams;

  const rawId = params.id || "";
  const idNormalized = rawId.trim().toLowerCase();
  const hasDatabase = Boolean(config.DATABASE_URL);
  const sessionId = searchParams?.sessionId;

  if (!hasDatabase) {
    const fallback = FALLBACK_CASES[idNormalized];
    if (fallback) {
      return (
        <LiveAequanClinicalWorkspace
          caseMeta={{
            title: fallback.title,
            specialty: fallback.specialty,
            caseId: fallback.id,
          }}
          backHref="/dashboard/prassi"
        >
          <SimulatorClient
            initialCaseData={fallback}
            sessionId={sessionId}
            isAdmin={false}
            persistReports={false}
            examCatalog={EXAM_DEFAULT_VALUES}
            embedded
            backHref="/dashboard/prassi"
          />
        </LiveAequanClinicalWorkspace>
      );
    }
    return notFound();
  }

  const user = await requireUser();
  const userId = user.id;

  const canPlay = await userCanPlayCase(userId, rawId).catch(() => false);
  if (!canPlay) {
    return notFound();
  }

  let caseData: {
    id: string;
    title: string;
    description: string;
    specialty: string | null;
    difficulty: string;
    estimatedDurationMinutes: number | null;
    correctSolution: string | null;
    baselineExamFindings: unknown;
    timeLimitMinutes: number | null;
    examLatencies: unknown;
    goldStandardPath: unknown;
    patientDeteriorationThreshold: number | null;
    nodes: { content: unknown }[];
  } | null = null;

  try {
    caseData = await prisma.clinicalCase.findUnique({
      where: { id: rawId },
      include: { nodes: { orderBy: { order: "asc" }, take: 1 } },
    });
  } catch {
    return notFound();
  }

  if (!caseData) {
    return notFound();
  }

  const [session, examCatalog, caseExamOverrides] = await Promise.all([
    sessionId
      ? prisma.caseSession.findUnique({ where: { id: sessionId } }).catch(() => null)
      : Promise.resolve(null),
    getExamValuesCatalog(),
    getCaseExamOverrides(rawId, caseData.baselineExamFindings),
  ]);

  // Do not wrap redirect()/notFound() in try/catch — Next throws control-flow errors.
  if (
    sessionId &&
    !isDevAuthBypass() &&
    (!session || session.userId !== userId || session.caseId !== rawId)
  ) {
    redirect(`/dashboard/prassi/play/${rawId}`);
  }

  if (sessionId && isDevAuthBypass() && session && session.caseId !== rawId) {
    redirect(`/dashboard/prassi/play/${rawId}`);
  }

  const firstNode = caseData.nodes[0];
  const basePatientPrompt =
    ((firstNode?.content as CaseNodeContent | null | undefined)?.casePrompt) ??
    "Paziente in simulazione. Rispondi come paziente, senza diagnosi e senza valori vitali a voce.";
  const baseline = (caseData.baselineExamFindings as CaseBaseline | null | undefined) ?? {};
  const demographics = baseline.demographics ?? {};

  const isVariant = Boolean(session?.isVariant);
  const effectivePrompt =
    isVariant && session?.variantPrompt ? session.variantPrompt : basePatientPrompt;

  const initialCaseData = {
    id: caseData.id,
    title: caseData.title,
    description: caseData.description,
    specialty: caseData.specialty ?? null,
    difficulty: caseData.difficulty,
    estimatedDurationMinutes: caseData.estimatedDurationMinutes ?? null,
    patientPrompt: effectivePrompt,
    // Gold answer stays server-side only (Art. 32 / anti-cheat).
    correctSolution: null,
    demographics: {
      age: demographics.age ?? null,
      sex: demographics.sex ?? null,
      context: demographics.context ?? null,
    },
    baselineExamFindings: baseline as Record<string, unknown>,
    timeLimitMinutes: caseData.timeLimitMinutes ?? null,
    examLatencies: (caseData.examLatencies as Record<string, number> | null) ?? null,
    goldStandardPath: (caseData.goldStandardPath as string[] | null) ?? null,
    patientDeteriorationThreshold: caseData.patientDeteriorationThreshold ?? null,
  };

  return (
    <LiveAequanClinicalWorkspace
      caseMeta={{
        title: caseData.title,
        specialty: caseData.specialty,
        patientAge: demographics.age ?? null,
        patientSex: demographics.sex ?? null,
        caseId: caseData.id,
      }}
      backHref="/dashboard/prassi"
    >
      <SimulatorClient
        initialCaseData={initialCaseData}
        isVariant={isVariant}
        sessionId={session?.id ?? sessionId}
        isAdmin={user.role === "ADMIN"}
        persistReports
        examCatalog={examCatalog}
        caseExamOverrides={caseExamOverrides}
        embedded
        backHref="/dashboard/prassi"
      />
    </LiveAequanClinicalWorkspace>
  );
}
