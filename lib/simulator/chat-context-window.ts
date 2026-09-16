type ChatTurn = { role: "user" | "assistant" | "system"; content: string };

/**
 * Maximum clinician user turns per simulation (anamnesis + PE + therapy plan).
 * Shared by the chat gate, the LLM dialogue window, and the simulator UI counter.
 */
export const PATIENT_MAX_TURNS = 35;

/**
 * Dialogue messages retained for the patient LLM (user + assistant).
 * 35 clinician turns × 2 roles so the model still sees the full encounter.
 */
export const PATIENT_CHAT_WINDOW_SIZE = PATIENT_MAX_TURNS * 2;

/**
 * Returns the trailing dialogue window for the virtual patient model.
 * System messages are excluded; no summarization to avoid clinical hallucinations.
 * Roles stay as OpenAI chat roles (user = medico, assistant = paziente).
 */
export function applyPatientChatWindow(
  messages: ChatTurn[],
  windowSize = PATIENT_CHAT_WINDOW_SIZE,
): ChatTurn[] {
  const dialogue = messages.filter(
    (m) =>
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.trim().length > 0,
  );
  const windowed = dialogue.length <= windowSize ? dialogue : dialogue.slice(-windowSize);

  // Explicit speaker labels reduce role-confusion / fidelity drift under long windows.
  return windowed.map((m) => {
    const prefix = m.role === "user" ? "[MEDICO]" : "[PAZIENTE]";
    const content = m.content.trim();
    if (content.startsWith("[MEDICO]") || content.startsWith("[PAZIENTE]")) {
      return { ...m, content };
    }
    return { ...m, content: `${prefix} ${content}` };
  });
}
