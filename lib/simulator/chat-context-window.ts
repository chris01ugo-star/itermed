type ChatTurn = { role: "user" | "assistant" | "system"; content: string };

/**
 * Safety ceiling for one encounter. The counter in the UI stays "Turno N"
 * until the conversation actually nears this cap.
 */
export const PATIENT_MAX_TURNS = 100;

/** Full user/assistant history kept verbatim, counted as clinician turns. */
export const PATIENT_FULL_HISTORY_TURNS = 60;
/** When the encounter is longer, keep the opening exchanges. */
export const PATIENT_MEMORY_HEAD_TURNS = 2;
/** …and the latest exchanges, plus a short summary of what fell in the middle. */
export const PATIENT_MEMORY_TAIL_TURNS = 50;

const FULL_MESSAGES = PATIENT_FULL_HISTORY_TURNS * 2;
const HEAD_MESSAGES = PATIENT_MEMORY_HEAD_TURNS * 2;
const TAIL_MESSAGES = PATIENT_MEMORY_TAIL_TURNS * 2;

export type WindowedPatientChat = {
  messages: ChatTurn[];
  /** Facts already said, only when the middle of a long encounter was folded. */
  memorySummary: string;
};

function dialogueOf(messages: ChatTurn[]): ChatTurn[] {
  return messages.filter(
    (message) =>
      (message.role === "user" || message.role === "assistant") &&
      typeof message.content === "string" &&
      message.content.trim().length > 0,
  );
}

function clipFact(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= 140) return clean;
  return `${clean.slice(0, 139).trim()}…`;
}

/**
 * Dialogue sent to the patient model.
 * Up to 60 clinician turns the history is complete.
 * After that, the first 2 turns, a compact recall of the middle, and the latest 50 turns stay.
 * Roles are not relabelled: a `[PAZIENTE]` prefix was being spoken back and then
 * mistaken for an unfilled slot.
 */
export function applyPatientChatWindow(messages: ChatTurn[]): WindowedPatientChat {
  const dialogue = dialogueOf(messages);
  if (dialogue.length <= FULL_MESSAGES) {
    return { messages: dialogue, memorySummary: "" };
  }
  const head = dialogue.slice(0, HEAD_MESSAGES);
  const tail = dialogue.slice(-TAIL_MESSAGES);
  const middle = dialogue.slice(HEAD_MESSAGES, dialogue.length - TAIL_MESSAGES);
  const facts = middle
    .map((message) => clipFact(message.content))
    .filter((line) => line.length >= 12)
    .slice(0, 14);
  const memorySummary = facts.length
    ? `Nel colloquio è già stato detto: ${facts.join(" · ")}`
    : "";
  return { messages: [...head, ...tail], memorySummary };
}
