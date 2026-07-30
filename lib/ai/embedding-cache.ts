import "server-only";
import { createHash } from "node:crypto";
import { embed } from "ai";
import { openai } from "@ai-sdk/openai";
import { createLogger } from "@/lib/logger";
import { getUpstashRedis } from "@/lib/security/rate-limit";
import { withOpenAIRetry } from "@/lib/ai/openai-retry";

const log = createLogger("embedding-cache");

/** Cache TTL for query embeddings — 24 hours. */
export const EMBEDDING_CACHE_TTL_SECONDS = 60 * 60 * 24;

export function embeddingCacheKey(queryText: string): string {
  const hash = createHash("sha256").update(queryText, "utf8").digest("hex");
  return `emb:${hash}`;
}

function coerceEmbedding(raw: unknown): number[] | null {
  if (Array.isArray(raw) && raw.every((n) => typeof n === "number")) {
    return raw as number[];
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.every((n) => typeof n === "number")) {
        return parsed as number[];
      }
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Embeds query text with `text-embedding-3-small`, caching vectors in Upstash Redis
 * under `emb:${sha256(query)}` when Redis is configured.
 */
export async function embedQueryTextCached(queryText: string): Promise<number[]> {
  const normalized = queryText.trim();
  const key = embeddingCacheKey(normalized);
  const redis = getUpstashRedis();

  if (redis) {
    try {
      const cached = await redis.get(key);
      const vector = coerceEmbedding(cached);
      if (vector && vector.length > 0) {
        log.debug("Embedding cache hit", { keyPrefix: key.slice(0, 12) });
        return vector;
      }
    } catch (error) {
      log.warn("Embedding cache read failed; calling OpenAI", { error });
    }
  }

  const embedding = await withOpenAIRetry(async () => {
    const { embedding: vector } = await embed({
      model: openai.embedding("text-embedding-3-small"),
      value: normalized,
    });
    return vector;
  });

  if (redis) {
    try {
      await redis.set(key, embedding, { ex: EMBEDDING_CACHE_TTL_SECONDS });
    } catch (error) {
      log.warn("Embedding cache write failed", { error });
    }
  }

  return embedding;
}
