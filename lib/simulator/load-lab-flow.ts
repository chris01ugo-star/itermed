import { prisma } from "@/lib/prisma";
import { isLaboratoryCase, parseLabFlow, type LabFlowNode } from "@/lib/simulator/laboratory-lis";

/** Loads the authored decision tree for a laboratory case. Other ids return null. */
export async function loadLabFlow(caseId: string, specialty?: string | null): Promise<LabFlowNode[] | null> {
  if (!isLaboratoryCase({ id: caseId, specialty })) return null;
  const row = await prisma.knowledgeBaseCase.findUnique({
    where: { id: caseId },
    select: { caseData: true },
  });
  return parseLabFlow(row?.caseData);
}

export async function withLabFlow<T extends { id: string; specialty?: string | null }>(
  payload: T,
): Promise<T & { labFlow?: LabFlowNode[] }> {
  const labFlow = await loadLabFlow(payload.id, payload.specialty);
  if (!labFlow) return payload;
  return { ...payload, labFlow };
}
