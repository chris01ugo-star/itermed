import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { userCanPlayCase } from "@/lib/access";
import { requireUser, isDevAuthBypass } from "@/lib/require-user";
import { SimulatorClient } from "@/components/simulator/SimulatorClient";
import { LiveAequanClinicalWorkspace } from "@/components/aequan/LiveAequanClinicalWorkspace";
import { getExamValuesCatalog, getCaseExamOverrides } from "@/lib/exam-values-service";
import { EXAM_DEFAULT_VALUES } from "@/lib/exam-default-values";
import {
  getFallbackCase,
  toSimulatorFallbackPayload,
} from "@/lib/cases/fallback-cases";
import {
  buildSimulatorCasePayload,
  extractPatientPromptFromNode,
} from "@/lib/cases/case-payload";

type PlayPageProps = {
  params: Promise<{ id: string }> | { id: string };
  searchParams?: Promise<{ sessionId?: string }> | { sessionId?: string };
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
    const fallback = getFallbackCase(idNormalized);
    if (fallback) {
      const initialCaseData = toSimulatorFallbackPayload(fallback);
      return (
        <LiveAequanClinicalWorkspace
          caseMeta={{
            title: fallback.title,
            specialty: fallback.specialty,
            patientAge: initialCaseData.demographics.age,
            patientSex: initialCaseData.demographics.sex,
            caseId: fallback.id,
          }}
          backHref="/dashboard/prassi"
        >
          <SimulatorClient
            initialCaseData={initialCaseData}
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
    isActive: boolean;
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
    const fallback = getFallbackCase(idNormalized);
    if (fallback) {
      const initialCaseData = toSimulatorFallbackPayload(fallback);
      return (
        <LiveAequanClinicalWorkspace
          caseMeta={{
            title: fallback.title,
            specialty: fallback.specialty,
            patientAge: initialCaseData.demographics.age,
            patientSex: initialCaseData.demographics.sex,
            caseId: fallback.id,
          }}
          backHref="/dashboard/prassi"
        >
          <SimulatorClient
            initialCaseData={initialCaseData}
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

  if (!caseData || !caseData.isActive) {
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
  const basePatientPrompt = extractPatientPromptFromNode(firstNode?.content);
  const isVariant = Boolean(session?.isVariant);
  const effectivePrompt =
    isVariant && session?.variantPrompt ? session.variantPrompt : basePatientPrompt;

  const initialCaseData = buildSimulatorCasePayload({
    id: caseData.id,
    title: caseData.title,
    description: caseData.description,
    specialty: caseData.specialty ?? null,
    difficulty: caseData.difficulty,
    estimatedDurationMinutes: caseData.estimatedDurationMinutes ?? null,
    patientPrompt: effectivePrompt,
    baselineExamFindings: caseData.baselineExamFindings,
    timeLimitMinutes: caseData.timeLimitMinutes ?? null,
    examLatencies: caseData.examLatencies,
    goldStandardPath: caseData.goldStandardPath,
    patientDeteriorationThreshold: caseData.patientDeteriorationThreshold ?? null,
  });

  return (
    <LiveAequanClinicalWorkspace
      caseMeta={{
        title: caseData.title,
        specialty: caseData.specialty,
        patientAge: initialCaseData.demographics.age,
        patientSex: initialCaseData.demographics.sex,
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
