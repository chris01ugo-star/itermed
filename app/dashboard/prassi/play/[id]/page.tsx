import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { config, isUsableDatabase } from "@/lib/config";
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
import { ensureRegisteredCaseInDb } from "@/lib/cases/ensure-registered-case";
import { getCaseById, normalizeCaseLookupKey } from "@/lib/data/cases/registry";
import { sanitizeLiveSessionId } from "@/lib/simulator/session-id";

type PlayPageProps = {
  params: Promise<{ id: string }> | { id: string };
  searchParams?: Promise<{ sessionId?: string }> | { sessionId?: string };
};

const DB_LOOKUP_TIMEOUT_MS = 4_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`[PrassiPlayPage] ${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function PlayLoadError({ caseId, message }: { caseId: string; message: string }) {
  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm font-semibold text-slate-800">Impossibile aprire la simulazione</p>
      <p className="text-sm leading-relaxed text-slate-600">{message}</p>
      <p className="text-xs text-slate-400">Caso: {caseId || "n/d"}</p>
      <a
        href="/dashboard/prassi"
        className="inline-flex h-10 items-center justify-center rounded-xl bg-[#1E324E] px-4 text-sm font-medium text-white hover:bg-[#2A486D]"
      >
        Torna alla Prassi
      </a>
    </div>
  );
}

function renderFallbackPlay(
  rawId: string,
  sessionId?: string,
  opts?: { persistReports?: boolean; isAdmin?: boolean },
) {
  const fallback = getFallbackCase(rawId);
  if (!fallback) return null;

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
        sessionId={sanitizeLiveSessionId(sessionId)}
        isAdmin={Boolean(opts?.isAdmin)}
        persistReports={Boolean(opts?.persistReports)}
        examCatalog={EXAM_DEFAULT_VALUES}
        embedded
        backHref="/dashboard/prassi"
      />
    </LiveAequanClinicalWorkspace>
  );
}

export default async function PrassiPlayPage(props: PlayPageProps) {
  let rawId = "";
  try {
    const params = "then" in props.params ? await props.params : props.params;
    const searchParams =
      props.searchParams && "then" in props.searchParams
        ? await props.searchParams
        : props.searchParams;

    rawId = params.id || "";
    const idNormalized = normalizeCaseLookupKey(rawId);
    const hasDatabase = isUsableDatabase(config.DATABASE_URL);
    const liveSessionId = sanitizeLiveSessionId(searchParams?.sessionId);

    if (!hasDatabase) {
      return (
        renderFallbackPlay(rawId, liveSessionId, { persistReports: false }) ??
        (
          <PlayLoadError
            caseId={rawId}
            message="Database non configurato e caso non disponibile offline."
          />
        )
      );
    }

    const user = await requireUser();
    const userId = user.id;

    // Best-effort materialize — never block the play UI on a slow/dead Neon pool.
    void ensureRegisteredCaseInDb(rawId, userId).catch((err) => {
      console.error("[PrassiPlayPage] ensureRegisteredCaseInDb failed", rawId, err);
    });

    const canPlay = await userCanPlayCase(userId, idNormalized).catch((err) => {
      console.error("[PrassiPlayPage] userCanPlayCase failed", idNormalized, err);
      return Boolean(getCaseById(rawId) || getFallbackCase(rawId));
    });
    if (!canPlay) {
      const offline = renderFallbackPlay(rawId, liveSessionId, {
        persistReports: false,
        isAdmin: user.role === "ADMIN",
      });
      if (offline) return offline;
      return notFound();
    }

    type CaseRow = {
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
    };

    let caseData: CaseRow | null = null;
    try {
      caseData = await withTimeout(
        prisma.clinicalCase.findUnique({
          where: { id: idNormalized },
          include: { nodes: { orderBy: { order: "asc" }, take: 1 } },
        }),
        DB_LOOKUP_TIMEOUT_MS,
        "clinicalCase.findUnique",
      );
    } catch (err) {
      console.error("[PrassiPlayPage] DB case lookup failed — using registry fallback", {
        caseId: idNormalized,
        error: err instanceof Error ? err.message : String(err),
      });
      caseData = null;
    }

    if (!caseData || !caseData.isActive) {
      // Retry ensure once, then fall back to authored registry payload.
      try {
        await withTimeout(ensureRegisteredCaseInDb(rawId, userId), 2_500, "ensureRegisteredCaseInDb");
        caseData = await withTimeout(
          prisma.clinicalCase.findUnique({
            where: { id: idNormalized },
            include: { nodes: { orderBy: { order: "asc" }, take: 1 } },
          }),
          2_500,
          "clinicalCase.findUnique.retry",
        );
      } catch (err) {
        console.error("[PrassiPlayPage] ensure+retry failed", idNormalized, err);
        caseData = null;
      }
    }

    if (!caseData || !caseData.isActive) {
      const offline = renderFallbackPlay(rawId, liveSessionId, {
        persistReports: false,
        isAdmin: user.role === "ADMIN",
      });
      if (offline) return offline;
      return (
        <PlayLoadError
          caseId={rawId}
          message="Il caso non è stato trovato nel database e non esiste un fallback offline."
        />
      );
    }

    const [session, examCatalog, caseExamOverrides] = await Promise.all([
      liveSessionId
        ? prisma.caseSession
            .findUnique({ where: { id: liveSessionId } })
            .catch((err) => {
              console.error("[PrassiPlayPage] session lookup failed", liveSessionId, err);
              return null;
            })
        : Promise.resolve(null),
      getExamValuesCatalog().catch(() => EXAM_DEFAULT_VALUES),
      getCaseExamOverrides(caseData.id, caseData.baselineExamFindings).catch(() => ({})),
    ]);

    if (
      liveSessionId &&
      !isDevAuthBypass() &&
      (!session || session.userId !== userId || session.caseId !== caseData.id)
    ) {
      redirect(`/dashboard/prassi/play/${caseData.id}`);
    }

    if (liveSessionId && isDevAuthBypass() && session && session.caseId !== caseData.id) {
      redirect(`/dashboard/prassi/play/${caseData.id}`);
    }

    // Dev bypass + offline/missing session token: drop bogus sessionId from the player.
    const effectiveSessionId = session?.id ?? (isDevAuthBypass() ? undefined : liveSessionId);

    const firstNode = caseData.nodes?.[0];
    const basePatientPrompt = extractPatientPromptFromNode(
      firstNode?.content,
      getFallbackCase(caseData.id)?.patientPrompt,
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
      examLatencies: caseData.examLatencies,
      goldStandardPath: caseData.goldStandardPath,
      patientDeteriorationThreshold: caseData.patientDeteriorationThreshold ?? null,
    });

    return (
      <LiveAequanClinicalWorkspace
        caseMeta={{
          title: caseData.title,
          specialty: caseData.specialty,
          patientAge: initialCaseData.demographics?.age ?? null,
          patientSex: initialCaseData.demographics?.sex ?? null,
          caseId: caseData.id,
        }}
        backHref="/dashboard/prassi"
      >
        <SimulatorClient
          initialCaseData={initialCaseData}
          isVariant={isVariant}
          sessionId={sanitizeLiveSessionId(effectiveSessionId)}
          isAdmin={user.role === "ADMIN"}
          persistReports
          examCatalog={examCatalog ?? EXAM_DEFAULT_VALUES}
          caseExamOverrides={caseExamOverrides ?? {}}
          embedded
          backHref="/dashboard/prassi"
        />
      </LiveAequanClinicalWorkspace>
    );
  } catch (err) {
    // Next.js control-flow exceptions must not be swallowed.
    const digest =
      err && typeof err === "object" && "digest" in err
        ? String((err as { digest?: unknown }).digest ?? "")
        : "";
    if (
      digest.startsWith("NEXT_REDIRECT") ||
      digest.startsWith("NEXT_NOT_FOUND") ||
      (err && typeof err === "object" && (err as { digest?: string }).digest === "NEXT_HTTP_ERROR_FALLBACK;404")
    ) {
      throw err;
    }
    console.error("[PrassiPlayPage] unhandled error — attempting fallback", {
      caseId: rawId,
      error: err instanceof Error ? err.message : String(err),
    });
    const offline = renderFallbackPlay(rawId, undefined, { persistReports: false });
    if (offline) return offline;
    return (
      <PlayLoadError
        caseId={rawId}
        message="Errore imprevisto durante il caricamento. Riprova tra qualche secondo."
      />
    );
  }
}
