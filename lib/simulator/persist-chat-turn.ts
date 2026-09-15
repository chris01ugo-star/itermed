import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";

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

  const session = await prisma.caseSession.findUnique({
    where: { id: sessionId },
    select: { chatHistory: true },
  });

  if (!session) {
    persistLogger.warn("Chat turn not persisted: session not found", { sessionId });
    return;
  }

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

  appended.push({ role: "assistant", content: trimmedAssistant, createdAt: now });

  await prisma.caseSession.update({
    where: { id: sessionId },
    data: {
      chatHistory: [...existing, ...appended],
    },
  });

  persistLogger.info("Chat turn persisted", {
    sessionId,
    appendedCount: appended.length,
    totalMessages: existing.length + appended.length,
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
