import { z } from "zod";
import { getSessionUserId } from "@/lib/api-session";
import { verifyLiveSessionOwner } from "@/lib/access";
import { detectMilestonesFromTurn } from "@/lib/simulator/milestone-tracker";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const bodySchema = z.object({
  sessionId: z.string().min(1),
  caseId: z.string().min(1).optional(),
  requestedExamIds: z.array(z.string()).default([]),
  examLabels: z.record(z.string(), z.string()).optional(),
  completedGoldSteps: z.array(z.string()).default([]),
  lastUserMessage: z.string().optional(),
  prescribedExams: z
    .array(z.object({ id: z.string(), name: z.string() }))
    .optional(),
});

/** Atomically syncs session milestones and requested exams before final evaluation. */
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const owns = await verifyLiveSessionOwner(body.sessionId, userId);
  if (!owns) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await prisma.caseSession.findUnique({
    where: { id: body.sessionId },
    select: { caseId: true, requestedExamIds: true, completedGoldSteps: true },
  });

  if (!session) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  if (body.caseId && session.caseId !== body.caseId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const mergedExamIds = [
    ...new Set([
      ...(Array.isArray(session.requestedExamIds) ? session.requestedExamIds : []),
      ...(Array.isArray(body.requestedExamIds) ? body.requestedExamIds : []),
    ]),
  ];
  const mergedGold = [
    ...new Set([
      ...(Array.isArray(session.completedGoldSteps) ? session.completedGoldSteps : []),
      ...(Array.isArray(body.completedGoldSteps) ? body.completedGoldSteps : []),
    ]),
  ];

  const detected = detectMilestonesFromTurn({
    userMessage: body.lastUserMessage,
    requestedExamIds: mergedExamIds,
    completedGoldSteps: mergedGold,
    examLabels: body.examLabels,
    prescribedExams: body.prescribedExams,
  });

  await prisma.$transaction(async (tx) => {
    await tx.caseSession.update({
      where: { id: body.sessionId },
      data: {
        requestedExamIds: mergedExamIds,
        completedGoldSteps: mergedGold,
      },
    });

    if (detected.length > 0) {
      await Promise.all(
        detected.map((m) =>
          tx.simulationMilestone.upsert({
            where: {
              sessionId_milestoneKey: {
                sessionId: body.sessionId,
                milestoneKey: m.milestoneKey,
              },
            },
            create: {
              sessionId: body.sessionId,
              milestoneKey: m.milestoneKey,
              label: m.label,
              category: m.category,
              source: m.source,
              evidence: m.evidence?.slice(0, 500) ?? null,
            },
            update: {
              evidence: m.evidence?.slice(0, 500) ?? null,
            },
          }),
        ),
      );
    }
  });

  const allMilestones = await prisma.simulationMilestone.findMany({
    where: { sessionId: body.sessionId },
    select: { milestoneKey: true },
  });

  return Response.json({
    ok: true,
    milestoneCount: detected.length,
    milestoneKeys: allMilestones.map((m) => m.milestoneKey),
    requestedExamIds: mergedExamIds,
  });
}
