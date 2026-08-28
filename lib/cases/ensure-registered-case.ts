/**
 * Upsert gold-standard registry cases into Prisma so CaseSession FK + play routes work.
 */

import { prisma } from "@/lib/prisma";
import { getCaseById, knowledgeBaseIdCandidates } from "@/lib/data/cases/registry";

export async function findClinicalCaseForSimulation(rawId: string) {
  const ids = knowledgeBaseIdCandidates(rawId);
  if (ids.length === 0) return null;
  return prisma.clinicalCase.findFirst({
    where: { id: { in: ids }, isActive: true },
    include: { nodes: { orderBy: { order: "asc" as const }, take: 1 } },
  });
}

export async function ensureRegisteredCaseInDb(
  caseId: string,
  createdById: string,
): Promise<{ id: string } | null> {
  const registered = await getCaseById(caseId);
  if (!registered) return null;

  const candidates = knowledgeBaseIdCandidates(registered.id);
  const existing = await prisma.clinicalCase.findFirst({
    where: { id: { in: candidates } },
    select: { id: true },
  });
  const id = existing?.id ?? registered.id;

  try {
    const row = await prisma.clinicalCase.upsert({
      where: { id },
      create: {
        id,
        title: registered.title,
        description: registered.description,
        specialty: registered.specialtyLabel,
        difficulty: registered.difficulty,
        isGlobal: true,
        isActive: true,
        estimatedDurationMinutes: registered.estimatedTimeMinutes,
        timeLimitMinutes: registered.timeLimitMinutes,
        patientDeteriorationThreshold: registered.patientDeteriorationThreshold,
        pastMedicalHistory: registered.pastMedicalHistory,
        correctSolution: registered.correctSolution,
        baselineExamFindings: registered.baselineExamFindings as object,
        goldStandardPath: registered.goldStandardPath,
        examLatencies: registered.examLatencies,
        createdById,
        nodes: {
          create: [
            {
              order: 0,
              type: "HISTORY",
              content: { casePrompt: registered.patientPrompt },
            },
          ],
        },
      },
      update: {
        title: registered.title,
        description: registered.description,
        specialty: registered.specialtyLabel,
        difficulty: registered.difficulty,
        isGlobal: true,
        isActive: true,
        estimatedDurationMinutes: registered.estimatedTimeMinutes,
        timeLimitMinutes: registered.timeLimitMinutes,
        patientDeteriorationThreshold: registered.patientDeteriorationThreshold,
        pastMedicalHistory: registered.pastMedicalHistory,
        correctSolution: registered.correctSolution,
        baselineExamFindings: registered.baselineExamFindings as object,
        goldStandardPath: registered.goldStandardPath,
        examLatencies: registered.examLatencies,
      },
      select: { id: true },
    });

    // Ensure at least one HISTORY node with patient prompt (create path already has it).
    const nodeCount = await prisma.caseNode.count({ where: { caseId: row.id } });
    if (nodeCount === 0) {
      await prisma.caseNode.create({
        data: {
          caseId: row.id,
          order: 0,
          type: "HISTORY",
          content: { casePrompt: registered.patientPrompt },
        },
      });
    }

    return row;
  } catch (err) {
    console.error("[ensureRegisteredCaseInDb]", id, err);
    return null;
  }
}
