import { openai } from "@ai-sdk/openai";

/** High clinical and medico-legal reasoning. */
export const MODEL_GPT_61_SOL = "gpt-6.1-sol";

/** Balanced evaluation and RAG pillar scoring. */
export const MODEL_GPT_61_TERRA = "gpt-6.1-terra";

/** High-volume chat, session tools, authoring, and lighter audits. */
export const MODEL_GPT_6_LUNA = "gpt-6-luna";

export type ChatModelId = typeof MODEL_GPT_6_LUNA;

/**
 * Chat Completions `reasoning_effort` for structured calls.
 * `gpt-6.1-sol` rejects `"none"` (HTTP 400). Luna and Terra keep reasoning off
 * so strict function calling is not preempted.
 * SDK 1.3 types only list low|medium|high; the runtime forwards `"none"` unchanged.
 */
export function reasoningEffortForModel(modelId: string): "none" | "low" {
  return modelId.includes("gpt-6.1-sol") ? "low" : "none";
}

/**
 * Chat model for `generateObject`.
 *
 * `structuredOutputs: true` makes the Vercel AI SDK send OpenAI
 * `response_format.json_schema.strict: true` (and `strict: true` on tool calls).
 */
export function openAIObjectModel(modelId: string) {
  return openai(modelId, {
    structuredOutputs: true,
    reasoningEffort: reasoningEffortForModel(modelId) as "low",
  });
}

/** Call-level provider option. Takes precedence over the model setting above. */
export function openAIObjectCall(modelId: string) {
  return {
    model: openAIObjectModel(modelId),
    providerOptions: {
      openai: {
        reasoningEffort: reasoningEffortForModel(modelId),
      },
    },
  };
}
