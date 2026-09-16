import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { withOpenAIRetry } from "@/lib/ai/openai-retry";
import {
  buildPatientSystemPrompt,
  type PatientSimulatorCaseInput,
} from "@/lib/simulator/patient-system-prompt";

export { buildPatientSystemPrompt, type PatientSimulatorCaseInput };

type ChatTurn = { role: "user" | "assistant" | "system"; content: string };

export type GeneratePatientResponseParams = {
  caseData: PatientSimulatorCaseInput;
  messages: ChatTurn[];
  /** OpenAI model for patient chat — always gpt-4o-mini (all plans). gpt-4o is evaluation/RAG only. */
  model?: "gpt-4o-mini";
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
  const modelId = params.model ?? "gpt-4o-mini";

  return withOpenAIRetry(async () =>
    streamText({
      model: openai(modelId),
      messages: [{ role: "system", content: systemPrompt }, ...params.messages],
      // Low temperature: clinical fidelity / anti-hallucination (closed-world case grounding).
      temperature: 0.25,
      maxTokens: 450,
      onFinish: params.onFinish
        ? async (event) => {
            await params.onFinish?.({ text: event.text });
          }
        : undefined,
    }),
  );
}
