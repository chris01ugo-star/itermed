import { z } from "zod";
import { getSessionUserId, unauthorizedJson } from "@/lib/api-session";
import { verifyLiveSessionOwner } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { loadStoredLabBlueprint } from "@/lib/simulator/load-lab-flow";
import { isLaboratoryCase } from "@/lib/simulator/laboratory-lis";
import { sanitizeLiveSessionId } from "@/lib/simulator/session-id";
import {
  LAB_DISPOSITIONS,
  LAB_INVESTIGATION_TARGETS,
  LAB_NOTIFY_CHANNELS,
  applyLabBenchCommand,
  extractLabBlueprintV2,
  parseLabWorkbenchState,
  sanitizeLabBlueprintForClient,
  type LabBenchCommand,
} from "@/lib/simulator/laboratory-workbench";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("INSPECT"),
    sessionId: z.string().min(1),
    target: z.enum(LAB_INVESTIGATION_TARGETS),
  }),
  z.object({
    action: z.literal("ORDER_REFLEX"),
    sessionId: z.string().min(1),
    reflexId: z.string().trim().min(1).max(80),
  }),
  z.object({
    action: z.literal("SET_DISPOSITION"),
    sessionId: z.string().min(1),
    analyteId: z.string().trim().min(1).max(80),
    disposition: z.enum(LAB_DISPOSITIONS),
    reasonCode: z.string().trim().min(2).max(48).optional(),
  }),
  z.object({
    action: z.literal("LOG_CRITICAL_NOTIFICATION"),
    sessionId: z.string().min(1),
    channel: z.enum(LAB_NOTIFY_CHANNELS),
    recipientName: z.string().trim().min(2).max(120).optional(),
    readBackConfirmed: z.boolean(),
  }),
  z.object({
    action: z.literal("SIGN_REPORT"),
    sessionId: z.string().min(1),
    validationNote: z.string().max(4000),
  }),
]);

function elapsedMinutes(session: { elapsedMinutes: number; createdAt: Date }): number {
  if (session.elapsedMinutes > 0) return session.elapsedMinutes;
  return Math.max(0, Math.round((Date.now() - session.createdAt.getTime()) / 60_000));
}

function toCommand(
  body: z.infer<typeof bodySchema>,
  atIso: string,
  minutes: number,
): LabBenchCommand {
  if (body.action === "INSPECT") return { action: "INSPECT", target: body.target, atIso };
  if (body.action === "ORDER_REFLEX") return { action: "ORDER_REFLEX", reflexId: body.reflexId, atIso };
  if (body.action === "SET_DISPOSITION") {
    return {
      action: "SET_DISPOSITION",
      analyteId: body.analyteId,
      disposition: body.disposition,
      reasonCode: body.reasonCode,
      atIso,
    };
  }
  if (body.action === "LOG_CRITICAL_NOTIFICATION") {
    return {
      action: "LOG_CRITICAL_NOTIFICATION",
      channel: body.channel,
      recipientName: body.recipientName,
      readBackConfirmed: body.readBackConfirmed,
      elapsedMinutes: minutes,
      atIso,
    };
  }
  return { action: "SIGN_REPORT", validationNote: body.validationNote, atIso };
}

export async function POST(req: Request) {
  try {
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
    const owns = await verifyLiveSessionOwner(liveSessionId, userId);
    if (!owns) {
      return Response.json({ error: "Forbidden", code: "FORBIDDEN_SESSION" }, { status: 403 });
    }

    const outcome = await prisma.$transaction(async (tx) => {
      const session = await tx.caseSession.findUnique({
        where: { id: liveSessionId },
        select: {
          caseId: true,
          elapsedMinutes: true,
          createdAt: true,
          labWorkbenchState: true,
          case: { select: { specialty: true, baselineExamFindings: true } },
        },
      });
      if (!session) {
        return { error: "Sessione non trovata.", code: "SESSION_NOT_FOUND", status: 404 as const };
      }
      const specialty = session.case?.specialty ?? "";
      const blueprint =
        (await loadStoredLabBlueprint(session.caseId)) ??
        extractLabBlueprintV2(session.case?.baselineExamFindings);
      if (!isLaboratoryCase({ id: session.caseId, specialty }) || !blueprint) {
        return {
          error: "Il banco LIS v2 non è attivo su questo caso.",
          code: "LAB_V1_UNSUPPORTED",
          status: 409 as const,
        };
      }
      const command = toCommand(body, new Date().toISOString(), elapsedMinutes(session));
      const applied = applyLabBenchCommand(
        blueprint,
        parseLabWorkbenchState(session.labWorkbenchState),
        command,
      );
      if (!applied.ok) return applied;
      await tx.caseSession.update({
        where: { id: liveSessionId },
        data: { labWorkbenchState: applied.state as Prisma.InputJsonValue },
      });
      return {
        ...applied,
        clientBlueprint: sanitizeLabBlueprintForClient(blueprint, applied.state),
      };
    });

    if (!("ok" in outcome)) {
      return Response.json({ error: outcome.error, code: outcome.code }, { status: outcome.status });
    }
    if (!outcome.ok) {
      return Response.json(
        {
          error: outcome.message,
          code: outcome.code,
          ...(outcome.missingAnalyteIds ? { missingAnalyteIds: outcome.missingAnalyteIds } : {}),
        },
        { status: outcome.status },
      );
    }
    return Response.json({
      state: outcome.state,
      blueprint: outcome.clientBlueprint,
      readyForReport: outcome.readyForReport,
    });
  } catch (err) {
    console.error("[POST /api/session/lab-action]", err);
    return Response.json({ error: "Internal error", code: "LAB_ACTION_FAILED" }, { status: 500 });
  }
}
