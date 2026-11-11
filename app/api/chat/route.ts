import { getSessionUserId, unauthorizedJson } from "@/lib/api-session";
import { assertUserCanPlayCase, authorizeSimulationAction } from "@/lib/access";
import { sanitizeLiveSessionId } from "@/lib/simulator/session-id";
import {
  assertAllowedChatModel,
  assertCanSendChatMessage,
  assertCanStartSimulation,
  gateToResponse,
  resolveChatModel,
  resolveClinicalUserMessageLimit,
} from "@/lib/billing/access-gate";
import { countSimulationsStartedAllTime, countSimulationsStartedToday } from "@/lib/billing/daily-sim-quota";
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
import { extractPatientPromptFromNode, usablePatientPrompt } from "@/lib/cases/case-payload";
import { buildPatientSimulatorCaseInput } from "@/lib/simulator/patientCaseContext";
import { generatePatientResponse } from "@/lib/simulator/generatePatientResponse";
import { getCaseById } from "@/lib/data/cases/registry";
import type { ClinicalCase, PatientProfile } from "@/lib/data/cases/types";
import { persistChatTurn } from "@/lib/simulator/persist-chat-turn";
import { isPrescriptionTrace } from "@/lib/simulator/prescription-trace";
import {
  buildDeteriorationInstruction,
  computeElapsedMinutesFromExams,
  inferCompletedGoldSteps,
  isGoldStandardMet,
  parseExamLatencies,
  parseGoldStandardPath,
} from "@/lib/cases/simulation-time";

export const runtime = "nodejs";
export const maxDuration = 300;

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

/**
 * Authored simulator script. Prefer the DB case node, then the knowledge-base
 * payload. The client copy is only a fallback so a player cannot strip the roleplay.
 */
type ChatAnamnesisClue = { prompt: string; rationale: string };

type ChatClinicalCase = {
  description: string;
  correctSolution: string | null;
  baselineExamFindings: unknown;
  examLatencies?: unknown;
  goldStandardPath?: unknown;
  patientDeteriorationThreshold?: number | null;
  setting?: string | null;
  condition?: string | null;
  presentation?: string | null;
  pastMedicalHistory?: string | null;
  redHerrings?: string[];
  anamnesisClues?: ChatAnamnesisClue[];
  physicalExamSummary?: string | null;
  patientProfile?: PatientProfile | null;
  patientPrompt?: string | null;
};

function anamnesisCluesFrom(raw: unknown): ChatAnamnesisClue[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as { prompt?: unknown; rationale?: unknown };
    const prompt = typeof row.prompt === "string" ? row.prompt.trim() : "";
    const rationale = typeof row.rationale === "string" ? row.rationale.trim() : "";
    if (!prompt && !rationale) return [];
    return [{ prompt, rationale }];
  });
}

function richFieldsFromCase(disk: ClinicalCase | undefined): Pick<
  ChatClinicalCase,
  | "setting"
  | "condition"
  | "presentation"
  | "pastMedicalHistory"
  | "redHerrings"
  | "anamnesisClues"
  | "physicalExamSummary"
  | "patientProfile"
  | "patientPrompt"
> {
  return {
    setting: disk?.setting ?? null,
    condition: disk?.condition ?? null,
    presentation: disk?.presentation ?? null,
    pastMedicalHistory: disk?.pastMedicalHistory ?? null,
    redHerrings: disk?.redHerrings ?? [],
    anamnesisClues: anamnesisCluesFrom(disk?.anamnesisQuestions),
    physicalExamSummary: disk?.physicalExam?.summary ?? null,
    patientProfile: disk?.patientProfile ?? null,
    patientPrompt: usablePatientPrompt(disk?.patientPrompt),
  };
}

async function loadServerRoleplayScript(caseId: string): Promise<string> {
  try {
    const fromFile = usablePatientPrompt((await getCaseById(caseId))?.patientPrompt);
    if (fromFile) return fromFile;
  } catch (err) {
    chatLogger.warn("Roleplay script file lookup failed", { caseId, err });
  }

  try {
    const node = await prisma.caseNode.findFirst({
      where: { caseId },
      orderBy: { order: "asc" },
      select: { content: true },
    });
    const fromNode = extractPatientPromptFromNode(node?.content, "");
    if (fromNode) return fromNode;

    const kb = await prisma.knowledgeBaseCase.findUnique({
      where: { id: caseId },
      select: { caseData: true },
    });
    if (kb?.caseData && typeof kb.caseData === "object" && !Array.isArray(kb.caseData)) {
      const prompt = usablePatientPrompt(
        (kb.caseData as { patientPrompt?: unknown }).patientPrompt,
      );
      if (prompt) return prompt;
    }
  } catch (err) {
    chatLogger.warn("Roleplay script DB lookup failed; trying case file", { caseId, err });
  }

  try {
    const fromFile = usablePatientPrompt((await getCaseById(caseId))?.patientPrompt);
    if (fromFile) return fromFile;
  } catch (err) {
    chatLogger.warn("Roleplay script file lookup failed", { caseId, err });
  }
  return "";
}

function chatCaseFromDisk(disk: ClinicalCase, includeSolution: boolean): ChatClinicalCase {
  const rich = richFieldsFromCase(disk);
  return {
    description: disk.description,
    correctSolution: includeSolution ? disk.correctSolution ?? null : null,
    baselineExamFindings: disk.baselineExamFindings,
    examLatencies: disk.examLatencies,
    goldStandardPath: disk.goldStandardPath,
    patientDeteriorationThreshold: disk.patientDeteriorationThreshold,
    ...rich,
  };
}

/** Prisma clinical row, then the knowledge-base JSON used by the play page. */
async function loadClinicalCaseForChat(
  caseId: string,
  includeSolution: boolean,
): Promise<ChatClinicalCase | null> {
  try {
    const diskFirst = await getCaseById(caseId);
    if (diskFirst?.description?.trim()) return chatCaseFromDisk(diskFirst, includeSolution);
  } catch (err) {
    chatLogger.warn("clinical case file lookup failed", { caseId, err });
  }

  let row: {
    description: string;
    correctSolution: string | null;
    pastMedicalHistory: string | null;
    baselineExamFindings: unknown;
    examLatencies: unknown;
    goldStandardPath: unknown;
    patientDeteriorationThreshold: number | null;
  } | null = null;
  try {
    row = await prisma.clinicalCase.findUnique({
      where: { id: caseId },
      select: {
        description: true,
        correctSolution: true,
        pastMedicalHistory: true,
        baselineExamFindings: true,
        examLatencies: true,
        goldStandardPath: true,
        patientDeteriorationThreshold: true,
      },
    });
  } catch (err) {
    chatLogger.warn("clinicalCase lookup failed; trying case file", { caseId, err });
  }

  let disk: ClinicalCase | undefined;
  try {
    disk = await getCaseById(caseId);
  } catch (err) {
    chatLogger.warn("clinical case file lookup failed", { caseId, err });
  }

  const description = disk?.description?.trim() || row?.description?.trim() || "";
  if (!description) return null;
  const rich = richFieldsFromCase(disk);
  const baselineClues = anamnesisCluesFrom(
    row?.baselineExamFindings &&
      typeof row.baselineExamFindings === "object" &&
      !Array.isArray(row.baselineExamFindings)
      ? (row.baselineExamFindings as { anamnesisQuestions?: unknown }).anamnesisQuestions
      : undefined,
  );

  return {
    description,
    correctSolution: includeSolution
      ? row?.correctSolution ?? disk?.correctSolution ?? null
      : null,
    baselineExamFindings: disk?.baselineExamFindings ?? row?.baselineExamFindings,
    examLatencies: row?.examLatencies ?? disk?.examLatencies,
    goldStandardPath: row?.goldStandardPath ?? disk?.goldStandardPath,
    patientDeteriorationThreshold:
      row?.patientDeteriorationThreshold ?? disk?.patientDeteriorationThreshold ?? null,
    ...rich,
    pastMedicalHistory: rich.pastMedicalHistory || row?.pastMedicalHistory || null,
    anamnesisClues: rich.anamnesisClues?.length ? rich.anamnesisClues : baselineClues,
    patientPrompt: rich.patientPrompt || null,
  };
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
  if (!userId) return unauthorizedJson();

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
  if (
    lastRawUserMessage &&
    !isPrescriptionTrace(lastRawUserMessage) &&
    shouldRejectUserChatInput(lastRawUserMessage)
  ) {
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

  const access = await authorizeSimulationAction({
    userId,
    sessionId: typeof sessionId === "string" ? sessionId : null,
    caseId: typeof caseId === "string" ? caseId : null,
  });
  if (!access.ok) {
    return new Response(JSON.stringify({ error: access.error, code: access.code }), {
      status: access.status,
      headers: { "Content-Type": "application/json" },
    });
  }
  const liveSessionId = sanitizeLiveSessionId(access.liveSessionId) ?? null;
  const clientRequestedExams = parseStringArray(requestedExamIds);
  const clientGoldSteps = parseStringArray(completedGoldSteps);

  let sessionVariantPrompt: string | null = null;
  let elapsedMinutes = 0;
  let deteriorationInstruction: string | null = null;

  if (!liveSessionId) {
    // No live session yet — apply the same soft daily gate as session start.
    const usedToday = await countSimulationsStartedToday(userId);
    const lifetimeUsed = await countSimulationsStartedAllTime(userId);
    const simGate = assertCanStartSimulation(billingProfile, { usedToday, lifetimeUsed });
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
      const sessionRequestedExamIds = Array.isArray(session.requestedExamIds)
        ? session.requestedExamIds
        : [];
      const sessionCompletedGoldSteps = Array.isArray(session.completedGoldSteps)
        ? session.completedGoldSteps
        : [];
      const mergedExamIds = [
        ...new Set([...sessionRequestedExamIds, ...clientRequestedExams]),
      ];

      elapsedMinutes = computeElapsedMinutesFromExams(mergedExamIds, examLatencies);

      const lastUserMessageForGold = getLastUserMessage(chatMessages);

      const inferredGold = inferCompletedGoldSteps({
        goldStandardPath: goldPath,
        requestedExamIds: mergedExamIds,
        clientCompletedSteps: [...sessionCompletedGoldSteps, ...clientGoldSteps],
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
          patientStress: stressClamped,
        },
      });
    }
  }

  let clinicalCase: ChatClinicalCase | null = null;

  if (caseId && typeof caseId === "string" && caseId.trim()) {
    const resolvedCaseId = caseId.trim();
    const accessDenied = await assertUserCanPlayCase(userId, resolvedCaseId);
    if (accessDenied) return accessDenied;

    // Gold answer only for an owned live session — never expose/map otherwise.
    const authorizedLiveSession = Boolean(liveSessionId);
    clinicalCase = await loadClinicalCaseForChat(resolvedCaseId, authorizedLiveSession);

    if (clinicalCase && !authorizedLiveSession) {
      const examLatencies = parseExamLatencies(clinicalCase.examLatencies);
      const goldPath = parseGoldStandardPath(clinicalCase.goldStandardPath);
      elapsedMinutes = computeElapsedMinutesFromExams(clientRequestedExams, examLatencies);
      const inferredGold = inferCompletedGoldSteps({
        goldStandardPath: goldPath,
        requestedExamIds: clientRequestedExams,
        clientCompletedSteps: clientGoldSteps,
        lastUserMessage: getLastUserMessage(chatMessages),
      });
      deteriorationInstruction = buildDeteriorationInstruction({
        elapsedMinutes,
        threshold: clinicalCase.patientDeteriorationThreshold,
        goldStandardMet: isGoldStandardMet(goldPath, inferredGold),
      });
    }
  }

  // Client-injected gold answers are never trusted — only DB correctSolution on owned sessions.
  // The roleplay script is the authored patientPrompt. A live variant replaces it;
  // otherwise the server copy wins over the browser body.
  let roleplayScript = usablePatientPrompt(sessionVariantPrompt);
  if (!roleplayScript && typeof caseId === "string" && caseId.trim()) {
    roleplayScript = await loadServerRoleplayScript(caseId.trim());
  }
  if (!roleplayScript) {
    roleplayScript = usablePatientPrompt(casePrompt);
  }

  let caseData = buildPatientSimulatorCaseInput({
    body: { ...body, casePrompt },
    clinicalCase,
    patientStress: stressClamped,
  });
  const clinicalStory = [
    clinicalCase?.description?.trim() || caseData.chiefComplaint,
    sessionVariantPrompt?.trim()
      ? `Variante di scenario: ${sessionVariantPrompt.trim()}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  caseData = {
    ...caseData,
    roleplayScript: roleplayScript || clinicalCase?.patientPrompt || "",
    clinicalStory,
    setting: clinicalCase?.setting,
    condition: clinicalCase?.condition,
    presentation: clinicalCase?.presentation,
    pastMedicalHistory: clinicalCase?.pastMedicalHistory,
    redHerrings: clinicalCase?.redHerrings,
    anamnesisClues: clinicalCase?.anamnesisClues,
    physicalExamSummary: clinicalCase?.physicalExamSummary,
    patientProfile: clinicalCase?.patientProfile,
  };

  if (deteriorationInstruction) {
    caseData = {
      ...caseData,
      deteriorationInstruction,
      patientStress: Math.max(caseData.patientStress, 85),
    };
  }

  const lastUserMessage = getLastUserMessage(chatMessages);

  // Trailing dialogue only — the persona is the streamText `system` argument, never a system message.
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

  const stream = await generatePatientResponse({
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
