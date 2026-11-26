import { createOpenAI } from "@ai-sdk/openai";

/**
 * GPT-6 ignores a Chat Completions `system` role. The AI SDK still emits one
 * for these model ids (it only rewrites `system` → `developer` for `o*` and
 * `gpt-5*`). This provider keeps the top-level `system` prompt and sends it
 * as `developer`.
 */
type Gpt6RequestBody = {
  messages?: Array<{ role?: string }>;
  max_tokens?: number;
  max_completion_tokens?: number;
  model?: string;
  temperature?: number;
};

/**
 * GPT-6 Chat Completions rejects `max_tokens` (HTTP 400). AI SDK v4 only
 * rewrites it to `max_completion_tokens` for `o*` and `gpt-5*`, so do it here.
 */
export function rewriteGpt6ChatBody(body: Gpt6RequestBody, requestUrl = ""): Gpt6RequestBody {
  if (Array.isArray(body.messages)) {
    body.messages = body.messages.map((message) =>
      message.role === "system" ? { ...message, role: "developer" } : message,
    );
  }
  if (typeof body.max_tokens === "number" && body.max_completion_tokens == null) {
    body.max_completion_tokens = body.max_tokens;
  }
  delete body.max_tokens;
  const modelId = `${body.model ?? ""} ${requestUrl}`.toLowerCase();
  // gpt-6.1-sol rejects temperature 0 (the AI SDK default for generateObject) with HTTP 400.
  if (modelId.includes("gpt-6.1-sol") && body.temperature != null && body.temperature !== 1) {
    delete body.temperature;
  }
  return body;
}

const gpt6 = createOpenAI({
  fetch: async (input, init) => {
    if (!init?.body || typeof init.body !== "string") {
      return fetch(input, init);
    }
    try {
      const body = JSON.parse(init.body) as Gpt6RequestBody;
      const requestUrl =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      return fetch(input, { ...init, body: JSON.stringify(rewriteGpt6ChatBody(body, requestUrl)) });
    } catch {
      return fetch(input, init);
    }
  },
});

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
  return gpt6(modelId, {
    structuredOutputs: true,
    reasoningEffort: reasoningEffortForModel(modelId) as "low",
  });
}

/** Patient chat. Reasoning stays off so the first token is not delayed. */
export function openAIChatModel(modelId: string) {
  return gpt6(modelId, {
    reasoningEffort: "none" as "low",
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
