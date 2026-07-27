import { getSessionUserId } from "@/lib/api-session";
import { verifyLiveSessionOwner } from "@/lib/access";
import {
  assertAllowedChatModel,
  assertCanSendChatMessage,
  assertCanStartSimulation,
  gateToResponse,
  resolveChatModel,
  resolveClinicalUserMessageLimit,
} from "@/lib/billing/access-gate";
import { countSimulationsStartedToday } from "@/lib/billing/daily-sim-quota";
import { getUserBillingProfile } from "@/lib/billing/user-billing";
import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { sanitizeUserMessagesForAI } from "@/lib/security/sanitize-for-ai";
import {
  MAX_CHAT_MESSAGES,
  shouldRejectUserChatInput,
} from "@/lib/security/prompt-injection-guard";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { AI_RATE_LIMITS, CHAT_MESSAGES_PER_MINUTE } from "@/lib/security/ai-rate-limits";
import { applyPatientChatWindow } from "@/lib/simulator/chat-context-window";
import { buildPatientSimulatorCaseInput } from "@/lib/simulator/patientCaseContext";
import { generatePatientResponse } from "@/lib/simulator/generatePatientResponse";
import { persistChatTurn } from "@/lib/simulator/persist-chat-turn";
import {
  buildDeteriorationInstruction,
  computeElapsedMinutesFromExams,
  inferCompletedGoldSteps,
  isGoldStandardMet,
  parseExamLatencies,
  parseGoldStandardPath,
} from "@/lib/cases/simulation-time";

export const runtime = "nodejs";
export const maxDuration = 60;

const chatLogger = createLogger("chat-api");

type ChatBody = Record<string, unknown> & {
  messages?: unknown;
  casePrompt?: unknown;
  sessionId?: unknown;
  patientStress?: unknown;
  caseId?: unknown;
  requestedExamIds?: unknown;
  completedGoldSteps?: unknown;
  model?: unknown;
  /** Optional per-case override for the user-message anamnesis cap. */
  maxUserMessages?: unknown;
  caseInput?: unknown;
};

type ChatTurn = { role: "user" | "assistant" | "system"; content: string };

function clampStress(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
}

function normalizeChatMessages(raw: unknown): ChatTurn[] {
  if (!Array.isArray(raw)) return [];
  return (raw as { role: string; content: string }[]).filter(
    (m) =>
      (m.role === "user" || m.role === "assistant" || m.role === "system") &&
      typeof m.content === "string",
  ) as ChatTurn[];
}

function getLastUserMessage(messages: ChatTurn[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === "user" && messages[i].content.trim()) {
      return messages[i].content.trim();
    }
  }
  return undefined;
}

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

/**
 * Resolves `caseInput.maxUserMessages` (or top-level `maxUserMessages`) for the session cap.
 */
function resolveMaxUserMessagesOverride(body: ChatBody): unknown {
  if (body.maxUserMessages != null) return body.maxUserMessages;
  const caseInput = body.caseInput;
  if (caseInput && typeof caseInput === "object" && !Array.isArray(caseInput)) {
    const record = caseInput as Record<string, unknown>;
    if (record.maxUserMessages != null) return record.maxUserMessages;
  }
  return undefined;
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Anti-abuse: max 10 chat messages / authenticated user / minute (Upstash or in-memory).
  const rateLimited = await enforceRateLimit(req, {
    namespace: "api-chat",
    limit: CHAT_MESSAGES_PER_MINUTE ?? AI_RATE_LIMITS.chat,
    userId,
  });
  if (rateLimited) return rateLimited;

  const billingProfile = await getUserBillingProfile(userId);
  if (!billingProfile) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { messages, casePrompt, sessionId, patientStress, caseId, requestedExamIds, completedGoldSteps, model } = body;
  const stressClamped = clampStress(patientStress);
  const chatMessagesPreview = normalizeChatMessages(messages);

  if (chatMessagesPreview.length > MAX_CHAT_MESSAGES) {
    return new Response(
      JSON.stringify({
        error: "Too many messages in conversation payload.",
        code: "CHAT_PAYLOAD_TOO_LARGE",
      }),
      { status: 413, headers: { "Content-Type": "application/json" } },
    );
  }

  const lastRawUserMessage = getLastUserMessage(chatMessagesPreview);
  if (lastRawUserMessage && shouldRejectUserChatInput(lastRawUserMessage)) {
    chatLogger.warn("Blocked chat input (injection / malicious payload)", {
      userId,
      length: lastRawUserMessage.length,
    });
    return new Response(
      JSON.stringify({
        error: "Messaggio non consentito: contenuto potenzialmente malevolo o non valido.",
        code: "CHAT_INPUT_REJECTED",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Sanitize early so downstream gold-inference never sees raw injection text.
  const chatMessages = sanitizeUserMessagesForAI(chatMessagesPreview);

  const maxUserMessagesOverride = resolveMaxUserMessagesOverride(body);
  const clinicalUserMessageLimit = resolveClinicalUserMessageLimit(maxUserMessagesOverride);

  const chatGate = assertCanSendChatMessage(billingProfile, chatMessages, {
    maxUserMessages: clinicalUserMessageLimit,
  });
  if (!chatGate.allowed) {
    chatLogger.info("Clinical anamnesis soft-stop", {
      userId,
      code: chatGate.code,
      limit: clinicalUserMessageLimit,
    });
    return gateToResponse(chatGate);
  }

  const modelGate = assertAllowedChatModel(billingProfile, model);
  if (!modelGate.allowed) {
    return gateToResponse(modelGate);
  }

  const chatModel = resolveChatModel(billingProfile);

  const liveSessionId =
    typeof sessionId === "string" && sessionId.trim().length > 0 ? sessionId.trim() : null;
  const clientRequestedExams = parseStringArray(requestedExamIds);
  const clientGoldSteps = parseStringArray(completedGoldSteps);

  let sessionVariantPrompt: string | null = null;
  let elapsedMinutes = 0;
  let deteriorationInstruction: string | null = null;

  if (liveSessionId) {
    const ok = await verifyLiveSessionOwner(liveSessionId, userId);
    if (!ok) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
  } else {
    // No live session yet — apply the same soft daily gate as session start.
    const usedToday = await countSimulationsStartedToday(userId);
    const simGate = assertCanStartSimulation(billingProfile, { usedToday });
    if (!simGate.allowed) {
      return gateToResponse(simGate);
    }
  }

  if (liveSessionId) {
    const session = await prisma.caseSession.findUnique({
      where: { id: liveSessionId },
      include: {
        case: {
          select: {
            examLatencies: true,
            goldStandardPath: true,
            patientDeteriorationThreshold: true,
          },
        },
      },
    });

    if (session?.variantPrompt) {
      sessionVariantPrompt = session.variantPrompt;
    }

    if (session?.case) {
      const examLatencies = parseExamLatencies(session.case.examLatencies);
      const goldPath = parseGoldStandardPath(session.case.goldStandardPath);
      const mergedExamIds = [
        ...new Set([...session.requestedExamIds, ...clientRequestedExams]),
      ];

      elapsedMinutes = computeElapsedMinutesFromExams(mergedExamIds, examLatencies);

      const lastUserMessageForGold = getLastUserMessage(chatMessages);

      const inferredGold = inferCompletedGoldSteps({
        goldStandardPath: goldPath,
        requestedExamIds: mergedExamIds,
        clientCompletedSteps: [...session.completedGoldSteps, ...clientGoldSteps],
        lastUserMessage: lastUserMessageForGold,
      });

      const goldMet = isGoldStandardMet(goldPath, inferredGold);
      deteriorationInstruction = buildDeteriorationInstruction({
        elapsedMinutes,
        threshold: session.case.patientDeteriorationThreshold,
        goldStandardMet: goldMet,
      });

      await prisma.caseSession.update({
        where: { id: liveSessionId },
        data: {
          elapsedMinutes,
          requestedExamIds: mergedExamIds,
          completedGoldSteps: inferredGold,
        },
      });
    }
  }

  let clinicalCase: {
    description: string;
    correctSolution: string | null;
    baselineExamFindings: unknown;
    examLatencies?: unknown;
    goldStandardPath?: unknown;
    patientDeteriorationThreshold?: number | null;
  } | null = null;

  if (caseId && typeof caseId === "string" && caseId.trim()) {
    const row = await prisma.clinicalCase.findUnique({
      where: { id: caseId.trim() },
      select: {
        description: true,
        correctSolution: true,
        baselineExamFindings: true,
        examLatencies: true,
        goldStandardPath: true,
        patientDeteriorationThreshold: true,
      },
    });
    if (row) {
      clinicalCase = row;

      if (!liveSessionId) {
        const examLatencies = parseExamLatencies(row.examLatencies);
        const goldPath = parseGoldStandardPath(row.goldStandardPath);
        elapsedMinutes = computeElapsedMinutesFromExams(clientRequestedExams, examLatencies);
        const inferredGold = inferCompletedGoldSteps({
          goldStandardPath: goldPath,
          requestedExamIds: clientRequestedExams,
          clientCompletedSteps: clientGoldSteps,
          lastUserMessage: getLastUserMessage(chatMessages),
        });
        deteriorationInstruction = buildDeteriorationInstruction({
          elapsedMinutes,
          threshold: row.patientDeteriorationThreshold,
          goldStandardMet: isGoldStandardMet(goldPath, inferredGold),
        });
      }
    }
  }

  let caseData = buildPatientSimulatorCaseInput({
    body: { ...body, casePrompt },
    clinicalCase,
    patientStress: stressClamped,
  });

  if (sessionVariantPrompt) {
    caseData = {
      ...caseData,
      chiefComplaint: `${caseData.chiefComplaint}\n\nVariante di scenario (contesto aggiuntivo per la simulazione):\n${sessionVariantPrompt}`,
    };
  }

  if (deteriorationInstruction) {
    caseData = {
      ...caseData,
      deteriorationInstruction,
      patientStress: Math.max(caseData.patientStress, 85),
    };
  }

  const lastUserMessage = getLastUserMessage(chatMessages);

  // Trailing dialogue only — system prompt is always prepended in generatePatientResponse.
  const windowedMessages = applyPatientChatWindow(chatMessages);

  chatLogger.info("Patient chat stream started", {
    userId,
    sessionId: liveSessionId ?? undefined,
    caseId: typeof caseId === "string" ? caseId : undefined,
    messageCount: chatMessages.length,
    windowedMessageCount: windowedMessages.length,
    patientStress: stressClamped,
    chatModel,
    planType: billingProfile.planType,
    elapsedMinutes,
    deteriorating: Boolean(deteriorationInstruction),
  });

  const stream = generatePatientResponse({
    caseData,
    messages: windowedMessages,
    model: chatModel,
    onFinish: liveSessionId
      ? async ({ text }) => {
          try {
            await persistChatTurn({
              sessionId: liveSessionId,
              userMessage: lastUserMessage,
              assistantMessage: text,
            });
          } catch (error) {
            chatLogger.error("Async chat persistence failed", {
              error,
              sessionId: liveSessionId,
            });
          }
        }
      : undefined,
  });

  return stream.toDataStreamResponse();
}
