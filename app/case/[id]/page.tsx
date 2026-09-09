import { notFound, redirect } from "next/navigation";
import { prisma } from "../../../lib/prisma";
import { config, isUsableDatabase } from "../../../lib/config";
import { userCanPlayCase } from "../../../lib/access";
import { requireUser, isDevAuthBypass } from "../../../lib/require-user";
import { SimulatorClient } from "../../../components/simulator/SimulatorClient";
import { LiveAequanClinicalWorkspace } from "@/components/aequan/LiveAequanClinicalWorkspace";
import { getExamValuesCatalog, getCaseExamOverrides } from "../../../lib/exam-values-service";
import { EXAM_DEFAULT_VALUES } from "../../../lib/exam-default-values";
import {
  getFallbackCase,
  toSimulatorFallbackPayload,
} from "@/lib/cases/fallback-cases";
import {
  buildSimulatorCasePayload,
  extractPatientPromptFromNode,
} from "@/lib/cases/case-payload";
import { ensureRegisteredCaseInDb, findClinicalCaseForSimulation } from "@/lib/cases/ensure-registered-case";
import { decodeCaseParam, normalizeCaseLookupKey } from "@/lib/data/cases/registry";
type CasePageProps = {
  params: Promise<{ id: string }> | { id: string };
  searchParams?:
    | Promise<{
        sessionId?: string;
      }>
    | {
        sessionId?: string;
      };
};

export default async function CasePage(props: CasePageProps) {
  const params = "then" in props.params ? await props.params : props.params;
  const searchParams =
    props.searchParams && "then" in props.searchParams
      ? await props.searchParams
      : props.searchParams;

  const rawId = decodeCaseParam(params.id || "");
  const idNormalized = normalizeCaseLookupKey(rawId);

  const hasDatabase = isUsableDatabase(config.DATABASE_URL);

  const sessionId = searchParams?.sessionId;

  // Se il database non è configurato, usiamo direttamente i casi demo / registry.
  if (!hasDatabase) {
    const fallback = await getFallbackCase(rawId);
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

  try {
    await ensureRegisteredCaseInDb(rawId, userId);

    const canPlay = await userCanPlayCase(userId, rawId);
    if (!canPlay) {
      const fallback = await getFallbackCase(rawId);
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

    const caseData = await findClinicalCaseForSimulation(rawId);

    if (!caseData || !caseData.isActive) {
      const fallback = await getFallbackCase(rawId);
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

    const [session, examCatalog, caseExamOverrides] = await Promise.all([
      sessionId
        ? prisma.caseSession.findUnique({
            where: { id: sessionId },
          })
        : Promise.resolve(null),
      getExamValuesCatalog(),
      getCaseExamOverrides(caseData.id, caseData.baselineExamFindings),
    ]);

    if (
      sessionId &&
      !isDevAuthBypass() &&
      (!session || session.userId !== userId || session.caseId !== caseData.id)
    ) {
      redirect(`/case/${caseData.id}`);
    }

    if (sessionId && isDevAuthBypass() && session && session.caseId !== caseData.id) {
      redirect(`/case/${caseData.id}`);
    }

    const firstNode = caseData.nodes[0];
    const fallbackPrompt = (await getFallbackCase(caseData.id))?.patientPrompt;
    const basePatientPrompt = extractPatientPromptFromNode(
      firstNode?.content,
      fallbackPrompt,
    );
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
  } catch {
    // DB non pronto — soft-fallback to in-memory cases when id matches.
    const fallback = await getFallbackCase(rawId);
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
  }

  return notFound();
}
