import { prisma } from "@/lib/prisma";
import { knowledgeBaseIdCandidates } from "@/lib/data/cases/registry-store";
import { isLaboratoryCase, parseLabFlow, type LabFlowNode } from "@/lib/simulator/laboratory-lis";
import {
  emptyLabWorkbenchState,
  extractLabBlueprintV2,
  parseLabWorkbenchState,
  sanitizeLabBlueprintForClient,
  type ClientLabBlueprint,
  type LabCaseBlueprint,
  type LabWorkbenchClientBundle,
} from "@/lib/simulator/laboratory-workbench";

/** Same id/code candidates used by the case registry, preferred in that order. */
export async function loadLabKnowledgeCase(caseId: string): Promise<{ id: string; caseData: unknown } | null> {
  const ids = knowledgeBaseIdCandidates(caseId);
  if (ids.length === 0) return null;
  const rows = await prisma.knowledgeBaseCase.findMany({
    where: { id: { in: ids } },
    select: { id: true, caseData: true },
  });
  if (rows.length === 0) return null;
  const rank = new Map(ids.map((id, index) => [id, index]));
  rows.sort((left, right) => (rank.get(left.id) ?? ids.length) - (rank.get(right.id) ?? ids.length));
  return rows[0] ?? null;
}

/** Blueprint v2 stored on KnowledgeBaseCase, including the audit envelope. */
export async function loadStoredLabBlueprint(caseId: string): Promise<LabCaseBlueprint | null> {
  const row = await loadLabKnowledgeCase(caseId);
  return extractLabBlueprintV2(row?.caseData) ?? null;
}

/** Loads the authored decision tree for a laboratory case. Other ids return null. */
export async function loadLabFlow(caseId: string, specialty?: string | null): Promise<LabFlowNode[] | null> {
  if (!isLaboratoryCase({ id: caseId, specialty })) return null;
  const row = await loadLabKnowledgeCase(caseId);
  return parseLabFlow(row?.caseData);
}

export type LabPlayContext = {
  baselineExamFindings?: unknown;
  sessionId?: string | null;
  startedAtIso: string;
};

function isMissingLabColumn(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /labWorkbenchState/i.test(message);
}

async function readOptionalLabWorkbenchState(sessionId: string): Promise<unknown | null> {
  try {
    const row = await prisma.caseSession.findUnique({
      where: { id: sessionId },
      select: { labWorkbenchState: true },
    });
    return row?.labWorkbenchState ?? null;
  } catch (error) {
    if (isMissingLabColumn(error)) return null;
    throw error;
  }
}

function withoutEmbeddedLabGold<T extends { baselineExamFindings?: unknown }>(
  payload: T,
  rawBaseline: unknown,
): T {
  if (!payload.baselineExamFindings || typeof payload.baselineExamFindings !== "object") return payload;
  const baseline = { ...(payload.baselineExamFindings as Record<string, unknown>) };
  delete baseline.blueprint;
  delete baseline.labBlueprint;
  delete baseline.labBlueprintV2;
  if (extractLabBlueprintV2(baseline) || extractLabBlueprintV2(rawBaseline)) {
    return { ...payload, baselineExamFindings: baseline && !extractLabBlueprintV2(baseline) ? baseline : {} };
  }
  return { ...payload, baselineExamFindings: baseline };
}

/**
 * Aggiunge l'albero v1 e, se il caso è un blueprint v2, solo il ticket sanitizzato.
 * Senza contesto di sessione il comportamento resta quello del flusso v1.
 */
export async function withLabFlow<T extends { id: string; specialty?: string | null; baselineExamFindings?: unknown }>(
  payload: T,
  context?: LabPlayContext,
): Promise<T & { labFlow?: LabFlowNode[]; labWorkbench?: LabWorkbenchClientBundle; labBlueprintV2?: ClientLabBlueprint }> {
  if (!isLaboratoryCase({ id: payload.id, specialty: payload.specialty })) return payload;

  const row = await loadLabKnowledgeCase(payload.id);
  const labFlow = parseLabFlow(row?.caseData);
  const blueprint =
    extractLabBlueprintV2(row?.caseData) ?? extractLabBlueprintV2(context?.baselineExamFindings);
  const safePayload = blueprint ? withoutEmbeddedLabGold(payload, context?.baselineExamFindings) : payload;

  let labWorkbench: LabWorkbenchClientBundle | undefined;
  if (blueprint && context) {
    const persisted = context.sessionId ? await readOptionalLabWorkbenchState(context.sessionId) : null;
    const state = parseLabWorkbenchState(persisted) ?? emptyLabWorkbenchState();
    labWorkbench = {
      blueprint: sanitizeLabBlueprintForClient(blueprint, state),
      state,
      startedAtIso: context.startedAtIso,
    };
  }

  if (!labFlow && !labWorkbench) return safePayload;
  return {
    ...safePayload,
    ...(labFlow ? { labFlow } : {}),
    ...(labWorkbench ? { labWorkbench, labBlueprintV2: labWorkbench.blueprint } : {}),
  };
}
