import { generateText } from "ai";
import { z } from "zod";
import { MODEL_GPT_6_LUNA, openAIChatModel } from "@/lib/ai/models";
import { getSessionUserId, unauthorizedJson } from "@/lib/api-session";
import { verifyLiveSessionOwner } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { shouldRejectUserChatInput } from "@/lib/security/prompt-injection-guard";
import {
  buildLabInterprofessionalSystemPrompt,
  detectReadBackSignal,
} from "@/lib/simulator/laboratory-interprofessional";
import { loadStoredLabBlueprint } from "@/lib/simulator/load-lab-flow";
import { isLaboratoryCase } from "@/lib/simulator/laboratory-lis";
import { sanitizeLiveSessionId } from "@/lib/simulator/session-id";
import {
  LAB_INTERLOCUTORS,
  appendLabInterprofessionalTurn,
  emptyLabWorkbenchState,
  extractLabBlueprintV2,
  filterLabConversationByTarget,
  parseLabWorkbenchState,
  type LabCaseBlueprint,
  type LabInterlocutor,
  type LabWorkbenchState,
} from "@/lib/simulator/laboratory-workbench";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

const bodySchema = z.object({
  sessionId: z.string().min(1),
  target: z.enum(LAB_INTERLOCUTORS),
  message: z.string().trim().min(1).max(1000),
});

const LINE_TIMEOUT_MS = 20_000;

class LabChatRejected extends Error {
  constructor(
    readonly status: 409,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function isMissingLabColumn(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /labWorkbenchState/i.test(message);
}

function readState(raw: unknown): LabWorkbenchState | "invalid" | null {
  if (raw == null) return null;
  return parseLabWorkbenchState(raw) ?? "invalid";
}

async function loadBench(liveSessionId: string): Promise<
  | { ok: true; blueprint: LabCaseBlueprint; state: LabWorkbenchState }
  | { ok: false; status: 404 | 409; code: string; error: string }
> {
  const session = await prisma.caseSession.findUnique({
    where: { id: liveSessionId },
    select: {
      caseId: true,
      labWorkbenchState: true,
      case: { select: { specialty: true, baselineExamFindings: true } },
    },
  });
  if (!session) {
    return { ok: false, status: 404, code: "SESSION_NOT_FOUND", error: "Sessione non trovata." };
  }
  const specialty = session.case?.specialty ?? "";
  const blueprint =
    (await loadStoredLabBlueprint(session.caseId)) ??
    extractLabBlueprintV2(session.case?.baselineExamFindings);
  if (!isLaboratoryCase({ id: session.caseId, specialty }) || !blueprint) {
    return {
      ok: false,
      status: 409,
      code: "LAB_V1_UNSUPPORTED",
      error: "La linea interna del banco LIS v2 non è attiva su questo caso.",
    };
  }
  const parsed = readState(session.labWorkbenchState);
  if (parsed === "invalid") {
    return {
      ok: false,
      status: 409,
      code: "LAB_STATE_INVALID",
      error: "Lo stato del banco non è leggibile.",
    };
  }
  const state = parsed ?? emptyLabWorkbenchState();
  if (state.signedAtIso) {
    return {
      ok: false,
      status: 409,
      code: "LAB_ALREADY_SIGNED",
      error: "Il referto è già firmato.",
    };
  }
  return { ok: true, blueprint, state };
}

async function completeLabLineReply(input: {
  blueprint: LabCaseBlueprint;
  state: LabWorkbenchState;
  target: LabInterlocutor;
  message: string;
}): Promise<string> {
  const history = filterLabConversationByTarget(input.state.interprofessionalLog, input.target);
  const messages = [
    ...history.map((row) => ({
      role: row.role === "user" ? ("user" as const) : ("assistant" as const),
      content: row.content,
    })),
    { role: "user" as const, content: input.message },
  ];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LINE_TIMEOUT_MS);
  try {
    const result = await generateText({
      model: openAIChatModel(MODEL_GPT_6_LUNA),
      providerOptions: { openai: { reasoningEffort: "none" } },
      system: buildLabInterprofessionalSystemPrompt({
        blueprint: input.blueprint,
        state: input.state,
        target: input.target,
      }),
      messages,
      maxTokens: 260,
      maxRetries: 0,
      abortSignal: controller.signal,
    });
    const reply = result.text.trim();
    if (!reply) throw new Error("Empty laboratory line reply");
    return reply;
  } finally {
    clearTimeout(timer);
  }
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
    if (shouldRejectUserChatInput(body.message)) {
      return Response.json(
        { error: "Messaggio non accettato.", code: "LAB_MESSAGE_REJECTED" },
        { status: 400 },
      );
    }

    const liveSessionId = sanitizeLiveSessionId(body.sessionId);
    if (!liveSessionId) {
      return Response.json({ error: "Forbidden", code: "FORBIDDEN_SESSION" }, { status: 403 });
    }
    const owns = await verifyLiveSessionOwner(liveSessionId, userId);
    if (!owns) {
      return Response.json({ error: "Forbidden", code: "FORBIDDEN_SESSION" }, { status: 403 });
    }

    let bench: Awaited<ReturnType<typeof loadBench>>;
    try {
      bench = await loadBench(liveSessionId);
    } catch (error) {
      if (isMissingLabColumn(error)) {
        return Response.json(
          { error: "Banco LIS non ancora disponibile.", code: "LAB_SCHEMA_PENDING" },
          { status: 503 },
        );
      }
      throw error;
    }
    if (!bench.ok) {
      return Response.json({ error: bench.error, code: bench.code }, { status: bench.status });
    }

    let reply: string;
    try {
      reply = await completeLabLineReply({
        blueprint: bench.blueprint,
        state: bench.state,
        target: body.target,
        message: body.message,
      });
    } catch (error) {
      console.error("[POST /api/session/lab-chat] line failed", error);
      return Response.json(
        { error: "Linea interna non disponibile.", code: "LAB_CHAT_FAILED" },
        { status: 500 },
      );
    }

    const userAtIso = new Date().toISOString();
    const replyAtIso = new Date(Date.now() + 1).toISOString();
    let saved: LabWorkbenchState;
    try {
      saved = await prisma.$transaction(async (tx) => {
        const fresh = await tx.caseSession.findUnique({
          where: { id: liveSessionId },
          select: { labWorkbenchState: true },
        });
        if (!fresh) {
          throw new LabChatRejected(409, "SESSION_NOT_FOUND", "Sessione non trovata.");
        }
        const current = readState(fresh.labWorkbenchState);
        if (current === "invalid") {
          throw new LabChatRejected(409, "LAB_STATE_INVALID", "Lo stato del banco non è leggibile.");
        }
        const base = current ?? emptyLabWorkbenchState();
        if (base.signedAtIso) {
          throw new LabChatRejected(409, "LAB_ALREADY_SIGNED", "Il referto è già firmato.");
        }
        const next = appendLabInterprofessionalTurn(base, {
          target: body.target,
          userMessage: body.message,
          reply,
          userAtIso,
          replyAtIso,
        });
        await tx.caseSession.update({
          where: { id: liveSessionId },
          data: { labWorkbenchState: next as Prisma.InputJsonValue },
        });
        return next;
      });
    } catch (error) {
      if (error instanceof LabChatRejected) {
        return Response.json({ error: error.message, code: error.code }, { status: error.status });
      }
      if (isMissingLabColumn(error)) {
        return Response.json(
          { error: "Banco LIS non ancora disponibile.", code: "LAB_SCHEMA_PENDING" },
          { status: 503 },
        );
      }
      throw error;
    }

    return Response.json({
      reply,
      target: body.target,
      createdAtIso: replyAtIso,
      readBackDetected: body.target === "clinician" && detectReadBackSignal(reply, bench.blueprint),
      interprofessionalLog: saved.interprofessionalLog,
    });
  } catch (error) {
    console.error("[POST /api/session/lab-chat]", error);
    return Response.json(
      { error: "Linea interna non disponibile.", code: "LAB_CHAT_FAILED" },
      { status: 500 },
    );
  }
}
