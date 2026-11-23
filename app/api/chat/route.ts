import { after } from "next/server";
import { getSessionUserId, unauthorizedJson } from "@/lib/api-session";
import {
  accessFromLoadedSession,
  assertUserCanPlayCase,
  userCanPlayCase,
} from "@/lib/access";
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
import {
  generatePatientResponse,
  logOpenAIStreamError,
} from "@/lib/simulator/generatePatientResponse";
import { resolvePatientProfile } from "@/lib/cases/resolve-patient-profile";
import { getCaseById } from "@/lib/data/cases/registry";
import type { ClinicalCase, PatientProfile } from "@/lib/data/cases/types";
import { flattenCatalogExams } from "@/lib/exam-catalog-structure";
import { isDevAuthBypass } from "@/lib/require-user";
import { persistChatTurn } from "@/lib/simulator/persist-chat-turn";
import { lockCaseSessionForUpdate } from "@/lib/simulator/case-session-lock";
import {
  appendStressTimeline,
  computePatientStress,
  resolveCaseStressProfile,
  withDeteriorationStress,
  type StressTimelineEntry,
} from "@/lib/simulator/patient-stress-engine";
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
type ChatAnamnesisClue = { prompt: string; rationale: string; expectedKeywords?: string[] };

function anamnesisCluesFrom(raw: unknown): ChatAnamnesisClue[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as { prompt?: unknown; rationale?: unknown; expectedKeywords?: unknown };
    const prompt = typeof row.prompt === "string" ? row.prompt.trim() : "";
    const rationale = typeof row.rationale === "string" ? row.rationale.trim() : "";
    const expectedKeywords = Array.isArray(row.expectedKeywords)
      ? row.expectedKeywords.filter((keyword): keyword is string => typeof keyword === "string" && keyword.trim().length > 0)
      : [];
    if (!prompt && !rationale && expectedKeywords.length === 0) return [];
    return [{ prompt, rationale, ...(expectedKeywords.length > 0 ? { expectedKeywords } : {}) }];
  });
}

type ChatClinicalCase = {
  id?: string | null;
  title?: string | null;
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
  diagnosis?: string | null;
  redHerrings?: string[];
  anamnesisClues?: ChatAnamnesisClue[];
  physicalExamSummary?: string | null;
  patientProfile?: PatientProfile | null;
  patientPrompt?: string | null;
};

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

async function loadServerRoleplayScript(
  caseId: string,
  preloadedDisk?: ClinicalCase | null,
): Promise<string> {
  if (preloadedDisk !== undefined) {
    const fromFile = usablePatientPrompt(preloadedDisk?.patientPrompt);
    if (fromFile) return fromFile;
  } else {
    try {
      const fromFile = usablePatientPrompt((await getCaseById(caseId))?.patientPrompt);
      if (fromFile) return fromFile;
    } catch (err) {
      chatLogger.warn("Roleplay script file lookup failed", { caseId, err });
    }
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

  if (preloadedDisk !== undefined) return "";

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
    id: disk.id,
    title: disk.title,
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
  preloadedDisk?: ClinicalCase | null,
): Promise<ChatClinicalCase | null> {
  let diskFirst = preloadedDisk ?? undefined;
  if (preloadedDisk === undefined) {
    try {
      diskFirst = await getCaseById(caseId);
    } catch (err) {
      chatLogger.warn("clinical case file lookup failed", { caseId, err });
    }
  }
  if (diskFirst?.description?.trim()) return chatCaseFromDisk(diskFirst, includeSolution);

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

  let disk = diskFirst;
  if (preloadedDisk === undefined) {
    try {
      disk = await getCaseById(caseId);
    } catch (err) {
      chatLogger.warn("clinical case file lookup failed", { caseId, err });
    }
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
    id: disk?.id ?? caseId,
    title: disk?.title ?? null,
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

type ChatCasePack = {
  clinicalCase: ChatClinicalCase | null;
  roleplayScript: string;
  fromDisk: boolean;
};

type LoadedChatSession = {
  id: string;
  userId: string;
  caseId: string;
  variantPrompt: string | null;
  requestedExamIds: unknown;
  completedGoldSteps: unknown;
  case: {
    examLatencies: unknown;
    goldStandardPath: unknown;
    patientDeteriorationThreshold: number | null;
  } | null;
};

let examNameById: Map<string, string> | null = null;

function labelsForExamIds(ids: string[]): string[] {
  if (!examNameById) {
    examNameById = new Map(flattenCatalogExams().map((exam) => [exam.id, exam.name]));
  }
  return ids.map((id) => examNameById?.get(id) ?? id.replace(/-/g, " "));
}

/** One case-file read shared by the clinical row and the roleplay script. */
async function loadChatCasePack(caseId: string, includeSolution: boolean): Promise<ChatCasePack> {
  let disk: ClinicalCase | undefined;
  try {
    disk = await getCaseById(caseId);
  } catch (err) {
    chatLogger.warn("clinical case file lookup failed", { caseId, err });
  }
  const [clinicalCase, roleplayScript] = await Promise.all([
    loadClinicalCaseForChat(caseId, includeSolution, disk ?? null),
    loadServerRoleplayScript(caseId, disk ?? null),
  ]);
  return {
    clinicalCase,
    roleplayScript,
    fromDisk: Boolean(disk?.description?.trim()),
  };
}

async function loadChatSession(sessionId: string): Promise<LoadedChatSession | null> {
  return prisma.caseSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      userId: true,
      caseId: true,
      variantPrompt: true,
      requestedExamIds: true,
      completedGoldSteps: true,
      case: {
        select: {
          examLatencies: true,
          goldStandardPath: true,
          patientDeteriorationThreshold: true,
        },
      },
    },
  });
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

  // Overlaps the body parse. The limit is still applied before any model call.
  const rateLimitPromise = enforceRateLimit(req, {
    namespace: "api-chat",
    limit: CHAT_MESSAGES_PER_MINUTE ?? AI_RATE_LIMITS.chat,
    userId,
  });
  const billingPromise = getUserBillingProfile(userId);

  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { messages, casePrompt, sessionId, patientStress, patientStressBefore, caseId, requestedExamIds, completedGoldSteps, model } = body;
  const stressClamped = clampStress(patientStress);
  const stressBefore = clampStress(patientStressBefore ?? patientStress);
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

  const rawSessionId = typeof sessionId === "string" ? sessionId : "";
  const resolvedCaseId = typeof caseId === "string" ? caseId.trim() : "";
  const liveCandidate = sanitizeLiveSessionId(rawSessionId);
  const clientRequestedExams = parseStringArray(requestedExamIds);
  const clientGoldSteps = parseStringArray(completedGoldSteps);

  const sessionPromise = liveCandidate ? loadChatSession(liveCandidate) : Promise.resolve(null);
  const casePackPromise = resolvedCaseId
    ? loadChatCasePack(resolvedCaseId, Boolean(liveCandidate))
    : Promise.resolve(null);
  const quotaPromise = liveCandidate
    ? Promise.resolve(null)
    : Promise.all([
        countSimulationsStartedToday(userId),
        countSimulationsStartedAllTime(userId),
      ]);
  const playGatePromise = (async (): Promise<Response | null> => {
    const pack = await casePackPromise;
    if (!resolvedCaseId || isDevAuthBypass() || pack?.fromDisk) return null;
    const profile = await billingPromise;
    if (!liveCandidate) {
      const canPlay = await userCanPlayCase(userId, resolvedCaseId);
      if (!canPlay) {
        return new Response(JSON.stringify({ error: "Forbidden", code: "FORBIDDEN_CASE" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
    return assertUserCanPlayCase(userId, resolvedCaseId, { profile });
  })();

  const [rateLimited, billingProfile, session, casePack, quota, playDenied] = await Promise.all([
    rateLimitPromise,
    billingPromise,
    sessionPromise,
    casePackPromise,
    quotaPromise,
    playGatePromise,
  ]).catch((error: unknown) => {
    chatLogger.error("Patient chat pre-stream failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  });

  if (rateLimited) return rateLimited;
  if (!billingProfile) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

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

  const access = accessFromLoadedSession({
    userId,
    rawSessionId,
    expectedCaseId: resolvedCaseId || null,
    session,
  });
  if (!access.ok) {
    return new Response(JSON.stringify({ error: access.error, code: access.code }), {
      status: access.status,
      headers: { "Content-Type": "application/json" },
    });
  }
  const liveSessionId = sanitizeLiveSessionId(access.liveSessionId) ?? null;

  if (!liveSessionId) {
    const [usedToday, lifetimeUsed] = quota ?? [0, 0];
    const simGate = assertCanStartSimulation(billingProfile, { usedToday, lifetimeUsed });
    if (!simGate.allowed) return gateToResponse(simGate);
  }

  if (playDenied) return playDenied;

  const sessionVariantPrompt: string | null = session?.variantPrompt ?? null;
  let elapsedMinutes = 0;
  let deteriorationInstruction: string | null = null;
  let mergedExamIds = clientRequestedExams;
  let sessionStateData: {
    elapsedMinutes: number;
    requestedExamIds: string[];
    completedGoldSteps: string[];
    patientStress: number;
  } | null = null;

  if (liveSessionId && session?.case) {
    const examLatencies = parseExamLatencies(session.case.examLatencies);
    const goldPath = parseGoldStandardPath(session.case.goldStandardPath);
    const sessionRequestedExamIds = Array.isArray(session.requestedExamIds)
      ? session.requestedExamIds.filter((id): id is string => typeof id === "string")
      : [];
    const sessionCompletedGoldSteps = Array.isArray(session.completedGoldSteps)
      ? session.completedGoldSteps.filter((id): id is string => typeof id === "string")
      : [];
    mergedExamIds = [...new Set([...sessionRequestedExamIds, ...clientRequestedExams])];
    elapsedMinutes = computeElapsedMinutesFromExams(mergedExamIds, examLatencies);
    const inferredGold = inferCompletedGoldSteps({
      goldStandardPath: goldPath,
      requestedExamIds: mergedExamIds,
      clientCompletedSteps: [...sessionCompletedGoldSteps, ...clientGoldSteps],
      lastUserMessage: getLastUserMessage(chatMessages),
    });
    deteriorationInstruction = buildDeteriorationInstruction({
      elapsedMinutes,
      threshold: session.case.patientDeteriorationThreshold,
      goldStandardMet: isGoldStandardMet(goldPath, inferredGold),
    });
    sessionStateData = {
      elapsedMinutes,
      requestedExamIds: mergedExamIds,
      completedGoldSteps: inferredGold,
      patientStress: stressClamped,
    };
  }

  const clinicalCase = casePack?.clinicalCase ?? null;
  const authorizedLiveSession = Boolean(liveSessionId);
  if (clinicalCase && !authorizedLiveSession) {
    const examLatencies = parseExamLatencies(clinicalCase.examLatencies);
    const goldPath = parseGoldStandardPath(clinicalCase.goldStandardPath);
    elapsedMinutes = computeElapsedMinutesFromExams(clientRequestedExams, examLatencies);
    mergedExamIds = clientRequestedExams;
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

  let roleplayScript = usablePatientPrompt(sessionVariantPrompt);
  if (!roleplayScript && casePack?.roleplayScript) {
    roleplayScript = casePack.roleplayScript;
  }
  if (!roleplayScript) {
    roleplayScript = usablePatientPrompt(casePrompt);
  }

  const stressBaseline =
    clinicalCase?.baselineExamFindings && typeof clinicalCase.baselineExamFindings === "object"
      ? (clinicalCase.baselineExamFindings as Record<string, unknown>)
      : undefined;
  const stressVitals =
    stressBaseline?.vitals && typeof stressBaseline.vitals === "object"
      ? (stressBaseline.vitals as Record<string, unknown>)
      : {};
  const stressProfile = resolveCaseStressProfile({
    id: clinicalCase?.id ?? (typeof caseId === "string" ? caseId : null),
    title: clinicalCase?.title,
    description: clinicalCase?.description ?? "",
    presentation: clinicalCase?.presentation,
    patientPrompt: roleplayScript || clinicalCase?.patientPrompt,
    setting: clinicalCase?.setting,
    emotionalState: clinicalCase?.patientProfile?.emotionalState,
    communicationStyle: clinicalCase?.patientProfile?.communicationStyle,
    baselineExamFindings: stressBaseline,
    goldStandardPath: parseGoldStandardPath(clinicalCase?.goldStandardPath),
  });
  const doctorLines = chatMessages
    .filter((message) => message.role === "user" && typeof message.content === "string")
    .map((message) => message.content);
  const spo2 = Number(stressVitals.spo2);
  const respiratoryRate = Number(stressVitals.respiratoryRate);
  const systolic = Number(String(stressVitals.bloodPressure ?? "").split("/")[0]);
  const communicationEvent = computePatientStress({
    currentStress: stressBefore,
    profile: stressProfile,
    lastUserMessage: doctorLines.at(-1) ?? "",
    recentDoctorMessages: doctorLines.slice(0, -1).slice(-4),
    requestedExamIds: mergedExamIds,
    spo2: Number.isFinite(spo2) ? spo2 : null,
    respiratoryRate: Number.isFinite(respiratoryRate) ? respiratoryRate : null,
    systolic: Number.isFinite(systolic) ? systolic : null,
    description: clinicalCase?.description,
  });
  const stressEvent = deteriorationInstruction ? withDeteriorationStress(communicationEvent) : communicationEvent;
  if (sessionStateData) sessionStateData.patientStress = stressEvent.stress;
  const stressTimelineEntry: StressTimelineEntry = {
    atMinute: elapsedMinutes,
    turn: doctorLines.length,
    stress: stressEvent.stress,
    delta: stressEvent.delta,
    reason: stressEvent.reason,
    category: stressEvent.category,
  };

  let sessionStateSaved = sessionStateData == null;
  const sessionStateWrite =
    liveSessionId && sessionStateData
      ? prisma
          .$transaction(async (tx) => {
            const locked = await lockCaseSessionForUpdate(tx, liveSessionId);
            if (!locked) return;
            const row = await tx.caseSession.findUnique({
              where: { id: liveSessionId },
              select: { stressTimeline: true },
            });
            const seeded =
              row?.stressTimeline == null
                ? [
                    {
                      atMinute: 0,
                      turn: 0,
                      stress: stressProfile.initialStress,
                      delta: 0,
                      reason: stressProfile.caseContext.baselineStatusLabel,
                      category: "baseline" as const,
                    },
                  ]
                : row.stressTimeline;
            await tx.caseSession.update({
              where: { id: liveSessionId },
              data: {
                ...sessionStateData,
                stressTimeline: appendStressTimeline(seeded, stressTimelineEntry),
              },
            });
          })
          .then(() => {
            sessionStateSaved = true;
          })
          .catch(async (error: unknown) => {
            chatLogger.error("Session state persistence failed", { error, sessionId: liveSessionId });
            sessionStateSaved = false;
          })
      : Promise.resolve();
  if (liveSessionId && sessionStateData && process.env.VERCEL) {
    try {
      after(() => sessionStateWrite);
    } catch (error) {
      chatLogger.error("after() unavailable; session state write already started", {
        error,
        sessionId: liveSessionId,
      });
    }
  }

  let caseData = buildPatientSimulatorCaseInput({
    body: { ...body, casePrompt },
    clinicalCase: clinicalCase
      ? {
          ...clinicalCase,
          id: clinicalCase.id ?? (typeof caseId === "string" ? caseId : null),
          patientPrompt: roleplayScript || clinicalCase.patientPrompt,
        }
      : null,
    patientStress: stressClamped,
  });
  const variantNote = sessionVariantPrompt?.trim()
    ? `Variante di scenario: ${sessionVariantPrompt.trim()}`
    : "";
  const chartProfile = clinicalCase
    ? resolvePatientProfile({
        id: clinicalCase.id ?? (typeof caseId === "string" ? caseId : null),
        title: clinicalCase.title,
        description: clinicalCase.description,
        patientPrompt: roleplayScript || clinicalCase.patientPrompt,
        pastMedicalHistory: clinicalCase.pastMedicalHistory,
        presentation: clinicalCase.presentation,
        setting: clinicalCase.setting,
        baselineExamFindings: clinicalCase.baselineExamFindings,
        correctSolution: clinicalCase.correctSolution,
        diagnosis: clinicalCase.diagnosis,
        condition: clinicalCase.condition,
      })
    : null;
  caseData = {
    ...caseData,
    roleplayScript: roleplayScript || clinicalCase?.patientPrompt || "",
    elapsedMinutes,
    completedExamLabels: labelsForExamIds(mergedExamIds),
    clinicalStory: [chartProfile?.triageAnamnesis || caseData.chiefComplaint, variantNote]
      .filter(Boolean)
      .join("\n\n"),
    setting: chartProfile?.setting || clinicalCase?.setting,
    condition: clinicalCase?.condition,
    presentation: chartProfile?.triageAnamnesis || clinicalCase?.presentation,
    pastMedicalHistory: chartProfile?.clinicalHistory || clinicalCase?.pastMedicalHistory,
    redHerrings: clinicalCase?.redHerrings,
    anamnesisClues: clinicalCase?.anamnesisClues,
    physicalExamSummary: clinicalCase?.physicalExamSummary,
    patientProfile: clinicalCase?.patientProfile,
    patientAge: chartProfile?.age != null ? String(chartProfile.age) : caseData.patientAge,
    patientName: chartProfile?.name || caseData.patientName,
    patientSex: chartProfile?.sex || caseData.patientSex,
    knownAllergies: chartProfile?.allergies ?? caseData.knownAllergies,
    patientStress: stressEvent.stress,
    stressReactivity: stressProfile.reactivityType,
    stressReason: stressEvent.reason,
    deteriorationInstruction: deteriorationInstruction ?? undefined,
  };

  const lastUserMessage = getLastUserMessage(chatMessages);

  // Trailing dialogue only — the persona is the streamText `system` argument, never a system message.
  const windowedMessages = applyPatientChatWindow(chatMessages);

  chatLogger.info("Patient chat stream started", {
    userId,
    sessionId: liveSessionId ?? undefined,
    caseId: typeof caseId === "string" ? caseId : undefined,
    messageCount: chatMessages.length,
    patientStress: stressEvent.stress,
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
            await sessionStateWrite;
            if (!sessionStateSaved && sessionStateData) {
              await prisma.caseSession.update({
                where: { id: liveSessionId },
                data: sessionStateData,
              });
            }
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

  return stream.toDataStreamResponse({
    headers: {
      "x-aequan-stress": String(stressEvent.stress),
      "x-aequan-stress-delta": String(stressEvent.delta),
      "x-aequan-stress-reason": encodeURIComponent(stressEvent.reason.slice(0, 180)),
      "x-aequan-stress-category": stressEvent.category,
      "x-aequan-stress-severity": stressEvent.severity,
    },
    getErrorMessage: (error) => {
      const described = logOpenAIStreamError(error);
      const status = described.status != null ? `HTTP ${described.status}` : "HTTP n/d";
      return `${status}: ${described.message}`;
    },
  });
}
