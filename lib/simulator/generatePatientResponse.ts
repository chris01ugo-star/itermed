import { streamText } from "ai";
import { withOpenAIRetry } from "@/lib/ai/openai-retry";
import { MODEL_GPT_6_LUNA, openAIChatModel, type ChatModelId } from "@/lib/ai/models";
import {
  buildPatientSystemPrompt,
  type PatientSimulatorCaseInput,
} from "@/lib/simulator/patient-system-prompt";

export { buildPatientSystemPrompt, type PatientSimulatorCaseInput };

type ChatTurn = { role: "user" | "assistant" | "system"; content: string };

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
  const systemPrompt = buildPatientSystemPrompt(params.caseData);
  const modelId = params.model ?? MODEL_GPT_6_LUNA;
  // GPT-6 drops a `system` role inside `messages`. The top-level `system`
  // argument is what the SDK maps to the developer instruction.
  const dialogue = params.messages.filter(
    (message): message is { role: "user" | "assistant"; content: string } =>
      (message.role === "user" || message.role === "assistant") &&
      typeof message.content === "string" &&
      message.content.trim().length > 0,
  );

  return withOpenAIRetry(async () =>
    streamText({
      // gpt-6-luna defaults to medium reasoning and blows the TTFB budget.
      // reasoningEffort is sent as Chat Completions reasoning_effort.
      model: openAIChatModel(modelId),
      providerOptions: {
        openai: { reasoningEffort: "none" },
      },
      system: systemPrompt,
      maxRetries: 3,
      messages: dialogue,
      onFinish: params.onFinish
        ? async (event) => {
            await params.onFinish?.({ text: event.text });
          }
        : undefined,
    }),
  );
}
