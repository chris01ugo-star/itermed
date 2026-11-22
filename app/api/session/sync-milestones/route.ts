import { z } from "zod";
import { getSessionUserId, unauthorizedJson } from "@/lib/api-session";
import { authorizeOwnedLiveSession } from "@/lib/access";
import { detectMilestonesFromTurn } from "@/lib/simulator/milestone-tracker";
import { lockCaseSessionForUpdate } from "@/lib/simulator/case-session-lock";
import { appendStressTimeline, type StressTimelineEntry } from "@/lib/simulator/patient-stress-engine";
import { prisma } from "@/lib/prisma";
import { sanitizeLiveSessionId } from "@/lib/simulator/session-id";

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
  stressEvent: z
    .object({
      atMinute: z.number(),
      turn: z.number(),
      stress: z.number(),
      delta: z.number(),
      reason: z.string().max(180),
      category: z.enum(["communication", "clinical_action", "deterioration", "time", "diagnosis", "baseline"]),
    })
    .optional(),
});

/** Atomically syncs session milestones and requested exams before final evaluation. */
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorizedJson();

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const liveSessionId = sanitizeLiveSessionId(body.sessionId);
  if (!liveSessionId) {
    return Response.json({ error: "Forbidden", code: "FORBIDDEN_SESSION" }, { status: 403 });
  }

  const access = await authorizeOwnedLiveSession({
    userId,
    sessionId: liveSessionId,
    expectedCaseId: body.caseId,
  });
  if (!access.ok) {
    return Response.json({ error: access.error, code: access.code }, { status: access.status });
  }

  const sessionKey = access.liveSessionId;

  const synced = await prisma.$transaction(async (tx) => {
    const locked = await lockCaseSessionForUpdate(tx, sessionKey);
    if (!locked) return null;

    const session = await tx.caseSession.findUnique({
      where: { id: sessionKey },
      select: { caseId: true, requestedExamIds: true, completedGoldSteps: true, stressTimeline: true },
    });
    if (!session) return null;
    if (body.caseId && session.caseId !== body.caseId && access.caseId !== body.caseId) {
      return { forbiddenCase: true as const };
    }

    const mergedExamIds = [
      ...new Set([
        ...(Array.isArray(session.requestedExamIds) ? session.requestedExamIds : []),
        ...body.requestedExamIds,
      ]),
    ];
    const mergedGold = [
      ...new Set([
        ...(Array.isArray(session.completedGoldSteps) ? session.completedGoldSteps : []),
        ...body.completedGoldSteps,
      ]),
    ];

    const detected = detectMilestonesFromTurn({
      userMessage: body.lastUserMessage,
      requestedExamIds: mergedExamIds,
      completedGoldSteps: mergedGold,
      examLabels: body.examLabels,
      prescribedExams: body.prescribedExams,
    });

    await tx.caseSession.update({
      where: { id: sessionKey },
      data: {
        requestedExamIds: mergedExamIds,
        completedGoldSteps: mergedGold,
        ...(body.stressEvent
          ? {
              patientStress: Math.max(0, Math.min(100, Math.round(body.stressEvent.stress))),
              stressTimeline: appendStressTimeline(session.stressTimeline, body.stressEvent satisfies StressTimelineEntry),
            }
          : {}),
      },
    });

    if (detected.length > 0) {
      await Promise.all(
        detected.map((m) =>
          tx.simulationMilestone.upsert({
            where: {
              sessionId_milestoneKey: {
                sessionId: sessionKey,
                milestoneKey: m.milestoneKey,
              },
            },
            create: {
              sessionId: sessionKey,
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

    return { forbiddenCase: false as const, mergedExamIds, detectedCount: detected.length };
  });

  if (!synced) {
    return Response.json({ error: "Forbidden", code: "FORBIDDEN_SESSION" }, { status: 403 });
  }
  if (synced.forbiddenCase) {
    return Response.json({ error: "Forbidden", code: "FORBIDDEN_CASE" }, { status: 403 });
  }

  const allMilestones = await prisma.simulationMilestone.findMany({
    where: { sessionId: sessionKey },
    select: { milestoneKey: true },
  });

  return Response.json({
    ok: true,
    milestoneCount: synced.detectedCount,
    milestoneKeys: allMilestones.map((m) => m.milestoneKey),
    requestedExamIds: synced.mergedExamIds,
  });
}
