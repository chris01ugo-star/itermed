import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { lockCaseSessionForUpdate } from "@/lib/simulator/case-session-lock";

const persistLogger = createLogger("persist-chat-turn");

/** Drop leaked speaker labels so restored bubbles show only the utterance. */
function stripPersistedChatRolePrefix(raw: string): string {
  let text = raw.trim();
  for (let i = 0; i < 3; i += 1) {
    const next = text
      .replace(
        /^\s*\[(?:assistant|user|system|function|data|tool|paziente|medico|patient|doctor)\]\s*:?\s*/i,
        "",
      )
      .replace(/^\s*(?:assistant|user|system|paziente|medico|patient|doctor)\s*:\s*/i, "")
      .trim();
    if (next === text) break;
    text = next;
  }
  return text;
}

export type PersistedChatTurn = {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export function parseChatHistory(raw: unknown): PersistedChatTurn[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter(
      (entry): entry is PersistedChatTurn =>
        typeof entry === "object" &&
        entry !== null &&
        (entry as PersistedChatTurn).role !== undefined &&
        ((entry as PersistedChatTurn).role === "user" ||
          (entry as PersistedChatTurn).role === "assistant") &&
        typeof (entry as PersistedChatTurn).content === "string" &&
        typeof (entry as PersistedChatTurn).createdAt === "string",
    )
    .map((entry) => ({
      role: entry.role,
      content: stripPersistedChatRolePrefix(entry.content),
      createdAt: entry.createdAt,
    }))
    .filter((entry) => entry.content.length > 0);
}

export type PersistChatTurnParams = {
  sessionId: string;
  userMessage?: string;
  assistantMessage: string;
};

/**
 * Appends the latest user + assistant chat turns to `CaseSession.chatHistory`.
 * Intended to run inside `streamText` `onFinish` so it never blocks TTFB.
 */
export async function persistChatTurn(params: PersistChatTurnParams): Promise<void> {
  const { sessionId, userMessage, assistantMessage } = params;
  const trimmedAssistant = stripPersistedChatRolePrefix(assistantMessage);
  if (!trimmedAssistant) return;

  const outcome = await prisma.$transaction(async (tx) => {
    const locked = await lockCaseSessionForUpdate(tx, sessionId);
    if (!locked) return null;

    const session = await tx.caseSession.findUnique({
      where: { id: sessionId },
      select: { chatHistory: true },
    });
    if (!session) return null;

    const existing = parseChatHistory(session.chatHistory);
    const now = new Date().toISOString();
    const appended: PersistedChatTurn[] = [];

    const trimmedUser = userMessage ? stripPersistedChatRolePrefix(userMessage) : "";
    if (trimmedUser) {
      const last = existing[existing.length - 1];
      const isDuplicateUser = last?.role === "user" && last.content === trimmedUser;
      if (!isDuplicateUser) {
        appended.push({ role: "user", content: trimmedUser, createdAt: now });
      }
    }

    const tail = [...existing, ...appended].at(-1);
    const duplicateAssistant = tail?.role === "assistant" && tail.content === trimmedAssistant;
    if (!duplicateAssistant) {
      appended.push({ role: "assistant", content: trimmedAssistant, createdAt: now });
    }

    if (appended.length === 0) {
      return { appendedCount: 0, totalMessages: existing.length };
    }

    const nextHistory = [...existing, ...appended];
    await tx.caseSession.update({
      where: { id: sessionId },
      data: { chatHistory: nextHistory },
    });
    return { appendedCount: appended.length, totalMessages: nextHistory.length };
  });

  if (!outcome) {
    persistLogger.warn("Chat turn not persisted: session not found", { sessionId });
    return;
  }

  persistLogger.info("Chat turn persisted", {
    sessionId,
    appendedCount: outcome.appendedCount,
    totalMessages: outcome.totalMessages,
  });
}

/** Reads persisted chat history for a live session (used for restore / audit). */
export async function getPersistedChatHistory(sessionId: string): Promise<PersistedChatTurn[]> {
  const session = await prisma.caseSession.findUnique({
    where: { id: sessionId },
    select: { chatHistory: true },
  });
  if (!session) return [];
  return parseChatHistory(session.chatHistory);
}
