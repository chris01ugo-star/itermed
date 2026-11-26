import { streamText } from "ai";
import { withOpenAIRetry } from "@/lib/ai/openai-retry";
import { createLogger } from "@/lib/logger";
import { MODEL_GPT_6_LUNA, openAIChatModel, type ChatModelId } from "@/lib/ai/models";
import {
  buildPatientOpeningMessage,
} from "@/lib/simulator/patient-opening";
import {
  createPatientOutputFilter,
  sanitizePatientUtterance,
} from "@/lib/simulator/patient-output-sanitizer";
import {
  buildPatientSystemPrompt,
  type PatientSimulatorCaseInput,
} from "@/lib/simulator/patient-system-prompt";

export { buildPatientSystemPrompt, type PatientSimulatorCaseInput };

const patientLogger = createLogger("patient-chat");

type ChatTurn = { role: "user" | "assistant" | "system"; content: string };

/** Status and provider message from an AI SDK / OpenAI failure. */
export function describeOpenAIError(error: unknown): { status?: number; message: string } {
  if (!error || typeof error !== "object") {
    return { message: error instanceof Error ? error.message : String(error ?? "unknown") };
  }
  const record = error as Record<string, unknown>;
  const status =
    typeof record.statusCode === "number"
      ? record.statusCode
      : typeof record.status === "number"
        ? record.status
        : undefined;
  let message = error instanceof Error ? error.message : String(error);
  const data = record.data;
  if (data && typeof data === "object") {
    const providerMessage = (data as { error?: { message?: unknown } }).error?.message;
    if (typeof providerMessage === "string" && providerMessage.trim()) {
      message = providerMessage.trim();
    }
  }
  if (typeof record.responseBody === "string" && record.responseBody.trim()) {
    try {
      const parsed = JSON.parse(record.responseBody) as { error?: { message?: unknown } };
      if (typeof parsed.error?.message === "string" && parsed.error.message.trim()) {
        message = parsed.error.message.trim();
      }
    } catch {
      message = record.responseBody.trim().slice(0, 500);
    }
  }
  return { status, message };
}

export function logOpenAIStreamError(error: unknown): { status?: number; message: string } {
  const described = describeOpenAIError(error);
  patientLogger.error("OpenAI patient stream failed", {
    status: described.status ?? null,
    message: described.message,
  });
  return described;
}

export type GeneratePatientResponseParams = {
  caseData: PatientSimulatorCaseInput;
  messages: ChatTurn[];
  /** OpenAI model for patient chat — always gpt-6-luna (all plans). */
  model?: ChatModelId;
  /** Runs after the stream completes — safe for async DB persistence. */
  onFinish?: (event: { text: string }) => void | Promise<void>;
};

/**
 * Streams the virtual patient's reply token-by-token via OpenAI.
 * Retries the initial `streamText` invocation on transient 429 / network errors.
 * Call `.toDataStreamResponse()` in the route handler.
 */
export async function generatePatientResponse(params: GeneratePatientResponseParams) {
  const symptomPhrase = buildPatientOpeningMessage({
    chiefComplaint: params.caseData.chiefComplaint,
    presentation: params.caseData.presentation,
    patientPrompt: params.caseData.roleplayScript,
    clinicalStory: params.caseData.clinicalStory,
    physicalExamSummary: params.caseData.physicalExamSummary,
    patientName: params.caseData.patientName,
    patientSex: params.caseData.patientSex,
  });
  const systemPrompt = buildPatientSystemPrompt(params.caseData);
  const modelId = params.model ?? MODEL_GPT_6_LUNA;
  const clinicianTurn = params.messages.filter((message) => message.role === "user").length;
  const sanitizeOptions = {
    turn: clinicianTurn,
    symptomPhrase,
    patientName: params.caseData.patientName,
  };
  // GPT-6 drops a `system` role inside `messages`. The top-level `system`
  // argument is what the SDK maps to the developer instruction.
  const dialogue = params.messages.filter(
    (message): message is { role: "user" | "assistant"; content: string } =>
      (message.role === "user" || message.role === "assistant") &&
      typeof message.content === "string" &&
      message.content.trim().length > 0,
  );

  return withOpenAIRetry(
    async () =>
    streamText({
      // gpt-6-luna defaults to medium reasoning and blows the TTFB budget.
      // reasoningEffort is sent as Chat Completions reasoning_effort.
      model: openAIChatModel(modelId),
      providerOptions: {
        openai: { reasoningEffort: "none" },
      },
      system: systemPrompt,
      maxTokens: 350,
      maxRetries: 0,
      messages: dialogue,
      experimental_transform: () => {
        const speechFilter = createPatientOutputFilter(sanitizeOptions);
        return new TransformStream({
          transform(part, controller) {
            if (part.type !== "text-delta") {
              controller.enqueue(part);
              return;
            }
            const safe = speechFilter.push(part.textDelta);
            if (safe) controller.enqueue({ type: "text-delta", textDelta: safe });
          },
          flush(controller) {
            const tail = speechFilter.finish();
            if (tail) controller.enqueue({ type: "text-delta", textDelta: tail });
          },
        });
      },
      onError: ({ error }) => {
        const described = logOpenAIStreamError(error);
        patientLogger.error("[CHAT_LLM_ERROR]", {
          status: described.status ?? null,
          message: described.message,
        });
      },
      onFinish: params.onFinish
        ? async (event) => {
            const spoken = sanitizePatientUtterance(event.text, sanitizeOptions);
            if (spoken !== event.text.trim()) {
              patientLogger.warn("[CHAT_SANITIZER]", {
                turn: clinicianTurn,
                before: event.text.slice(0, 180),
                after: spoken.slice(0, 180),
              });
            }
            await params.onFinish?.({ text: spoken });
          }
        : undefined,
    }),
    { maxAttempts: 2 },
  );
}
