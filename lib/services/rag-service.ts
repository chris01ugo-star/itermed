import { openai } from "@ai-sdk/openai";
import { embed } from "ai";
import { config } from "@/lib/config";
import { RAGServiceError } from "@/lib/errors";
import { createLogger, type Logger } from "@/lib/logger";
import { getPineconeIndex, type PineconeIndex } from "@/lib/pinecone";
import { prisma } from "@/lib/prisma";
import { sanitizeForExternalAI } from "@/lib/security/sanitize-for-ai";
import { truncateForLlmContext } from "@/lib/security/prompt-context";

const LEGAL_TOP_K = 8;
const PROTOCOL_TOP_K = 4;
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

/**
 * Minimum Pinecone cosine similarity to accept a match as "relevant context".
 * Matches below this threshold are treated as soft-fail (no usable RAG context).
 */
const MIN_PINECONE_SIMILARITY = 0.35;

const PROTOCOL_TAG_HINTS = [
  "protocollo",
  "protocolli",
  "linee guida",
  "linee-guida",
  "lineeguida",
];

const LEGAL_TAG_HINTS = [
  "legale",
  "gelli-bianco",
  "gelli bianco",
  "decreto",
  "normativa",
  "regolamento",
  "tutela",
  "medico-legale",
  "medico legale",
  "responsabilit",
  "consenso",
  "privacy",
  "codice deontologico",
];

const PROTOCOL_PINECONE_TAGS = ["protocollo", "protocolli", "linee guida", "linee-guida"];

export type GuidelineChunk = {
  content: string;
  title: string;
  tags: string[];
  documentId?: string;
  kind: "legal" | "protocol";
};

export type GuidelineRetrievalSection = {
  chunks: GuidelineChunk[];
  sources: string[];
  combinedText: string;
  source: "pinecone" | "postgres" | "none";
  /** True when at least one chunk passed retrieval + confidence filters. */
  hasContext: boolean;
  /** Count of accepted source titles (0 ⇒ soft-fail for this section). */
  ragSourcesCount: number;
};

export type RelevantGuidelines = {
  query: string;
  legal: GuidelineRetrievalSection;
  protocol: GuidelineRetrievalSection;
  /** Specialty-scoped legal corpus available for evaluation. */
  hasLegalContext: boolean;
  /** Specialty-scoped clinical protocol corpus available for evaluation. */
  hasProtocolContext: boolean;
};

export type GetRelevantGuidelinesParams = {
  finalDiagnosis?: string;
  caseContext?: string;
  reportText?: string;
  tags?: string[];
  /** Canonical specialty id from `MedicalSpecialty`. */
  specialtyId?: string;
  /** Human-readable specialty name (e.g. "Cardiologia"). */
  specialtyName?: string;
};

export type GuidelineDocumentRecord = {
  id: string;
  title: string;
  tags: string[];
  text: string;
};

/** Persistence port for active guideline documents (PostgreSQL via Prisma). */
export type GuidelineDocumentStore = {
  findActiveDocuments(): Promise<GuidelineDocumentRecord[]>;
};

export type EmbedFn = (params: {
  model: ReturnType<typeof openai.embedding>;
  value: string;
}) => Promise<{ embedding: number[] }>;

export type RagServiceDeps = {
  guidelineStore: GuidelineDocumentStore;
  getPineconeIndex: () => PineconeIndex | null;
  embed: EmbedFn;
  isPineconeConfigured: boolean;
  logger: Logger;
};

type PineconeMetadata = {
  content?: string;
  title?: string;
  tags?: string | string[];
  documentId?: string;
  medicalSpecialtyId?: string;
};

/**
 * When a case has a specialty, retrieve only docs tagged with that specialty
 * plus transversal docs (`medicalSpecialtyId` null / missing) so national legal
 * frameworks remain available without pulling other specialties' protocols.
 */
function buildPostgresSpecialtyFilter(specialtyId?: string): {
  OR: Array<{ medicalSpecialtyId: string | null }>;
} | Record<string, never> {
  if (!specialtyId) return {};
  return {
    OR: [{ medicalSpecialtyId: specialtyId }, { medicalSpecialtyId: null }],
  };
}

function buildPineconeSpecialtyFilter(specialtyId?: string): Record<string, unknown> | undefined {
  if (!specialtyId) return undefined;
  return {
    $or: [
      { medicalSpecialtyId: { $eq: specialtyId } },
      { medicalSpecialtyId: { $exists: false } },
    ],
  };
}

function mergePineconeFilters(
  ...filters: Array<Record<string, unknown> | undefined>
): Record<string, unknown> | undefined {
  const present = filters.filter((f): f is Record<string, unknown> => Boolean(f));
  if (present.length === 0) return undefined;
  if (present.length === 1) return present[0];
  return { $and: present };
}

function chunkText(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    const end = Math.min(start + size, normalized.length);
    let chunk = normalized.slice(start, end);

    if (end < normalized.length) {
      const lastPeriod = chunk.lastIndexOf(".");
      if (lastPeriod > size * 0.5) {
        chunk = chunk.slice(0, lastPeriod + 1);
      }
    }

    chunks.push(chunk.trim());
    if (end === normalized.length) break;
    start = end - overlap;
  }

  return chunks.filter((c) => c.length > 0);
}

function normalizeTag(tag: string): string {
  return tag.toLowerCase().trim();
}

function isLegalGuideline(tags: string[]): boolean {
  const normalized = tags.map(normalizeTag);
  const hasLegalHint = normalized.some((tag) =>
    LEGAL_TAG_HINTS.some((hint) => tag.includes(hint)),
  );
  if (hasLegalHint) return true;

  const isProtocolOnly =
    normalized.length > 0 &&
    normalized.every((tag) => PROTOCOL_TAG_HINTS.some((hint) => tag.includes(hint)));

  return !isProtocolOnly;
}

function isProtocolGuideline(tags: string[]): boolean {
  const normalized = tags.map(normalizeTag);
  return normalized.some((tag) => PROTOCOL_TAG_HINTS.some((hint) => tag.includes(hint)));
}

function buildSpecialtyTagHints(specialtyName?: string): string[] {
  if (!specialtyName?.trim()) return [];

  const normalized = normalizeTag(specialtyName);
  const hints = new Set<string>([normalized]);

  // Common Italian specialty shorthands used as document tags.
  const shorthandMap: Record<string, string[]> = {
    cardiologia: ["cardio", "cardiologico", "cuore"],
    emergenza: ["emergenze", "urgenza", "pronto soccorso", "ps"],
    "medicina interna": ["internistica", "interno"],
    neurologia: ["neuro", "neurologico"],
    pediatria: ["pediatrico", "pediatra"],
    chirurgia: ["chirurgico", "operatorio"],
    ginecologia: ["ginecologico", "ostetricia"],
    psichiatria: ["psichiatrico", "salute mentale"],
    radiologia: ["radiologico", "imaging"],
    anestesia: ["anestesiologia", "rianimazione"],
  };

  for (const [key, variants] of Object.entries(shorthandMap)) {
    if (normalized.includes(key) || variants.some((v) => normalized.includes(v))) {
      hints.add(key);
      variants.forEach((v) => hints.add(v));
    }
  }

  return [...hints];
}

function parseMetadataTags(metadata: PineconeMetadata): string[] {
  if (Array.isArray(metadata.tags)) {
    return metadata.tags.map(String);
  }
  if (typeof metadata.tags === "string") {
    return metadata.tags.split(",").map((t) => t.trim());
  }
  return [];
}

function chunkMatchesSpecialty(tags: string[], specialtyHints: string[]): boolean {
  if (specialtyHints.length === 0) return false;
  const normalizedTags = tags.map(normalizeTag);
  return normalizedTags.some((tag) =>
    specialtyHints.some((hint) => tag.includes(hint) || hint.includes(tag)),
  );
}

function scoreChunkWithSpecialty(
  query: string,
  chunk: string,
  tags: string[],
  specialtyHints: string[],
): number {
  let score = scoreChunk(query, chunk);
  if (chunkMatchesSpecialty(tags, specialtyHints)) {
    score += 4;
  }
  return score;
}

function rankChunksByRelevance(
  chunks: Array<GuidelineChunk & { score: number }>,
  limit: number,
  specialtyHints: string[],
): GuidelineChunk[] {
  const specialtyMatched = chunks.filter((c) => chunkMatchesSpecialty(c.tags, specialtyHints));
  const generic = chunks.filter((c) => !chunkMatchesSpecialty(c.tags, specialtyHints));

  specialtyMatched.sort((a, b) => b.score - a.score);
  generic.sort((a, b) => b.score - a.score);

  const merged = [...specialtyMatched, ...generic];
  return merged.slice(0, limit).map(({ score: _score, ...chunk }) => chunk);
}

function buildRagQuery(params: GetRelevantGuidelinesParams): string {
  const { finalDiagnosis, caseContext, reportText, tags, specialtyName } = params;
  const caseKeywords = caseContext?.trim().slice(0, 800) ?? "";
  const tagHints = tags?.filter(Boolean).join(" ") ?? "";
  const specialtyHints = buildSpecialtyTagHints(specialtyName).join(" ");

  const parts = [
    finalDiagnosis?.trim() ? sanitizeForExternalAI(finalDiagnosis.trim()) : undefined,
    caseKeywords ? sanitizeForExternalAI(caseKeywords) : undefined,
    specialtyName?.trim(),
    specialtyHints,
    tagHints,
    "tutela medico-legale responsabilità professionale documentazione consenso informato",
  ].filter((part) => part && part.length > 0);

  if (parts.length > 0) return parts.join("\n");
  return reportText?.trim()
    ? sanitizeForExternalAI(reportText.trim())
    : "valutazione clinica simulazione medico-legale";
}

function scoreChunk(query: string, chunk: string): number {
  const queryTokens = new Set(
    query
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((token) => token.length > 3),
  );
  if (queryTokens.size === 0) return 0;

  const chunkLower = chunk.toLowerCase();
  let score = 0;
  for (const token of queryTokens) {
    if (chunkLower.includes(token)) score += 1;
  }
  return score;
}

function toSection(
  chunks: GuidelineChunk[],
  source: "pinecone" | "postgres" | "none",
): GuidelineRetrievalSection {
  const safeChunks = Array.isArray(chunks) ? chunks.filter((c) => c?.content?.trim()) : [];
  const sources = [...new Set(safeChunks.map((c) => c.title).filter(Boolean))];
  const hasContext = safeChunks.length > 0 && source !== "none";
  const rawCombined = safeChunks.map((c) => `[${c.title}]\n${c.content}`).join("\n---\n");
  return {
    chunks: safeChunks,
    sources,
    combinedText: truncateForLlmContext(rawCombined),
    source: hasContext ? source : "none",
    hasContext,
    ragSourcesCount: sources.length,
  };
}

const defaultGuidelineStore: GuidelineDocumentStore = {
  findActiveDocuments: () =>
    prisma.guidelineDocument.findMany({
      where: { isActive: true },
      select: { id: true, title: true, tags: true, text: true },
      orderBy: { updatedAt: "desc" },
    }),
};

/**
 * Retrieves legal and clinical protocol guidelines via Pinecone with PostgreSQL fallback.
 */
export class RagService {
  constructor(private readonly deps: RagServiceDeps) {}

  /**
   * Builds a semantic query and retrieves the most relevant legal and protocol chunks.
   */
  async getRelevantGuidelines(params: GetRelevantGuidelinesParams): Promise<RelevantGuidelines> {
    const query = buildRagQuery(params);
    const specialtyId = params.specialtyId?.trim() || undefined;
    const specialtyHints = buildSpecialtyTagHints(params.specialtyName);
    const log = this.deps.logger.child({
      specialtyId,
      specialtyName: params.specialtyName,
    });

    let legalChunks: GuidelineChunk[] = [];
    let protocolChunks: GuidelineChunk[] = [];
    let legalSource: GuidelineRetrievalSection["source"] = "none";
    let protocolSource: GuidelineRetrievalSection["source"] = "none";

    try {
      const embedding = await this.embedQuery(query);
      if (embedding) {
        legalChunks = await this.retrieveLegalFromPinecone(
          query,
          embedding,
          specialtyHints,
          specialtyId,
        );
        protocolChunks = await this.retrieveProtocolFromPinecone(
          embedding,
          specialtyHints,
          specialtyId,
        );
        if (legalChunks.length > 0) legalSource = "pinecone";
        if (protocolChunks.length > 0) protocolSource = "pinecone";
      }
    } catch (error) {
      log.warn("Pinecone retrieval failed, falling back to PostgreSQL", { error });
    }

    if (legalChunks.length === 0) {
      try {
        legalChunks = await this.retrieveLegalFromPostgres(query, specialtyHints, specialtyId);
        if (legalChunks.length > 0) legalSource = "postgres";
      } catch (error) {
        log.warn("PostgreSQL legal retrieval failed", { error });
      }
    }

    if (protocolChunks.length === 0) {
      try {
        protocolChunks = await this.retrieveProtocolFromPostgres(
          query,
          specialtyHints,
          specialtyId,
        );
        if (protocolChunks.length > 0) protocolSource = "postgres";
      } catch (error) {
        log.warn("PostgreSQL protocol retrieval failed", { error });
      }
    }

    if (legalChunks.length === 0 && protocolChunks.length === 0) {
      log.info("No guidelines retrieved from any source (RAG soft-fail)", {
        queryLength: query.length,
      });
    } else {
      log.info("Guidelines retrieved with specialty scope", {
        specialtyId: specialtyId ?? null,
        specialtyHintCount: specialtyHints.length,
        legalChunks: legalChunks.length,
        protocolChunks: protocolChunks.length,
      });
    }

    const legal = toSection(legalChunks, legalSource);
    const protocol = toSection(protocolChunks, protocolSource);

    return {
      query,
      legal,
      protocol,
      hasLegalContext: legal.hasContext,
      hasProtocolContext: protocol.hasContext,
    };
  }

  private async embedQuery(query: string): Promise<number[] | null> {
    if (!this.deps.isPineconeConfigured) {
      return null;
    }

    const index = this.deps.getPineconeIndex();
    if (!index) {
      return null;
    }

    try {
      const { embedding } = await this.deps.embed({
        model: openai.embedding("text-embedding-3-small"),
        value: query,
      });
      return embedding;
    } catch (error) {
      throw RAGServiceError.fromUnknown(error);
    }
  }

  private async retrieveLegalFromPinecone(
    query: string,
    embedding: number[],
    specialtyHints: string[],
    specialtyId?: string,
    limit = LEGAL_TOP_K,
  ): Promise<GuidelineChunk[]> {
    const index = this.deps.getPineconeIndex();
    if (!index) return [];

    const specialtyFilter = buildPineconeSpecialtyFilter(specialtyId);
    const response = await index.namespace("guidelines").query({
      topK: Math.max(limit * 3, 18),
      vector: embedding,
      includeMetadata: true,
      ...(specialtyFilter ? { filter: specialtyFilter } : {}),
    });

    const ranked: Array<GuidelineChunk & { score: number }> = [];
    for (const match of response.matches ?? []) {
      const pineconeScore = typeof match.score === "number" ? match.score : 0;
      if (pineconeScore < MIN_PINECONE_SIMILARITY) continue;

      const metadata = (match.metadata ?? {}) as PineconeMetadata;
      const content = typeof metadata.content === "string" ? metadata.content.trim() : "";
      if (!content) continue;

      // Defense-in-depth: drop vectors from other specialties even if filter is ignored.
      if (
        specialtyId &&
        typeof metadata.medicalSpecialtyId === "string" &&
        metadata.medicalSpecialtyId !== specialtyId
      ) {
        continue;
      }

      const title = typeof metadata.title === "string" ? metadata.title : "Documento legale";
      const tags = parseMetadataTags(metadata);
      if (!isLegalGuideline(tags)) continue;

      ranked.push({
        content,
        title,
        tags,
        documentId: typeof metadata.documentId === "string" ? metadata.documentId : undefined,
        kind: "legal",
        score:
          pineconeScore +
          scoreChunkWithSpecialty(query, `${title} ${content}`, tags, specialtyHints) * 0.1,
      });
    }

    return rankChunksByRelevance(ranked, limit, specialtyHints);
  }

  private async retrieveProtocolFromPinecone(
    embedding: number[],
    specialtyHints: string[],
    specialtyId?: string,
    limit = PROTOCOL_TOP_K,
  ): Promise<GuidelineChunk[]> {
    const index = this.deps.getPineconeIndex();
    if (!index) return [];

    const specialtyFilter = buildPineconeSpecialtyFilter(specialtyId);
    const protocolFilter = mergePineconeFilters(
      { tags: { $in: PROTOCOL_PINECONE_TAGS } },
      specialtyFilter,
    );

    // When specialtyId is set, skip the soft tag-hint query — ID filter is authoritative.
    const tagHintFilter =
      !specialtyId && specialtyHints.length > 0
        ? mergePineconeFilters({ tags: { $in: specialtyHints } }, specialtyFilter)
        : undefined;

    const queries = [
      index.namespace("guidelines").query({
        topK: Math.max(limit * 2, 8),
        vector: embedding,
        includeMetadata: true,
        ...(protocolFilter ? { filter: protocolFilter } : {}),
      }),
      ...(tagHintFilter
        ? [
            index.namespace("guidelines").query({
              topK: Math.max(limit * 2, 8),
              vector: embedding,
              includeMetadata: true,
              filter: tagHintFilter,
            }),
          ]
        : []),
    ];

    const responses = await Promise.all(queries);
    const ranked: Array<GuidelineChunk & { score: number }> = [];

    for (const response of responses) {
      for (const match of response.matches ?? []) {
        const pineconeScore = typeof match.score === "number" ? match.score : 0;
        if (pineconeScore < MIN_PINECONE_SIMILARITY) continue;

        const metadata = (match.metadata ?? {}) as PineconeMetadata;
        const content = typeof metadata.content === "string" ? metadata.content.trim() : "";
        if (!content) continue;

        if (
          specialtyId &&
          typeof metadata.medicalSpecialtyId === "string" &&
          metadata.medicalSpecialtyId !== specialtyId
        ) {
          continue;
        }

        const title = typeof metadata.title === "string" ? metadata.title : "Protocollo clinico";
        const tags = parseMetadataTags(metadata);

        ranked.push({
          content,
          title,
          tags,
          documentId: typeof metadata.documentId === "string" ? metadata.documentId : undefined,
          kind: "protocol",
          score:
            pineconeScore +
            (chunkMatchesSpecialty(tags, specialtyHints) ? 2 : 0) +
            (isProtocolGuideline(tags) ? 1 : 0),
        });
      }
    }

    return rankChunksByRelevance(ranked, limit, specialtyHints);
  }

  private async retrieveLegalFromPostgres(
    query: string,
    specialtyHints: string[],
    specialtyId?: string,
    limit = LEGAL_TOP_K,
  ): Promise<GuidelineChunk[]> {
    const docs = await prisma.guidelineDocument.findMany({
      where: {
        isActive: true,
        tags: { hasSome: LEGAL_TAG_HINTS },
        ...buildPostgresSpecialtyFilter(specialtyId),
      },
      select: { id: true, title: true, tags: true, text: true },
      take: 15,
    });
    const ranked: Array<GuidelineChunk & { score: number }> = [];

    for (const doc of docs) {
      for (const content of chunkText(doc.text)) {
        ranked.push({
          content,
          title: doc.title,
          tags: doc.tags,
          documentId: doc.id,
          kind: "legal",
          score: scoreChunkWithSpecialty(query, `${doc.title} ${content}`, doc.tags, specialtyHints),
        });
      }
    }

    return rankChunksByRelevance(ranked, limit, specialtyHints);
  }

  private async retrieveProtocolFromPostgres(
    query: string,
    specialtyHints: string[],
    specialtyId?: string,
    limit = PROTOCOL_TOP_K,
  ): Promise<GuidelineChunk[]> {
    const docs = await prisma.guidelineDocument.findMany({
      where: {
        isActive: true,
        ...buildPostgresSpecialtyFilter(specialtyId),
        // With specialtyId the FK is the primary scope; tags only refine when no ID is known.
        ...(specialtyId
          ? {}
          : specialtyHints.length > 0
            ? { tags: { hasSome: specialtyHints } }
            : { tags: { hasSome: PROTOCOL_PINECONE_TAGS } }),
      },
      select: { id: true, title: true, tags: true, text: true },
      take: 10,
    });
    const ranked: Array<GuidelineChunk & { score: number }> = [];

    for (const doc of docs) {
      for (const content of chunkText(doc.text)) {
        ranked.push({
          content,
          title: doc.title,
          tags: doc.tags,
          documentId: doc.id,
          kind: "protocol",
          score: scoreChunkWithSpecialty(query, `${doc.title} ${content}`, doc.tags, specialtyHints),
        });
      }
    }

    return rankChunksByRelevance(ranked, limit, specialtyHints);
  }
}

/**
 * Factory for {@link RagService} with injectable dependencies (defaults to production wiring).
 */
export function createRagService(overrides: Partial<RagServiceDeps> = {}): RagService {
  return new RagService({
    guidelineStore: overrides.guidelineStore ?? defaultGuidelineStore,
    getPineconeIndex: overrides.getPineconeIndex ?? getPineconeIndex,
    embed: overrides.embed ?? embed,
    isPineconeConfigured: overrides.isPineconeConfigured ?? config.isPineconeConfigured,
    logger: overrides.logger ?? createLogger("rag-service"),
  });
}

const defaultRagService = createRagService();

/** Default RAG service wired with production dependencies. */
export const ragService = defaultRagService;

/** Convenience wrapper around the default {@link RagService} instance. */
export function getRelevantGuidelines(
  params: GetRelevantGuidelinesParams,
): Promise<RelevantGuidelines> {
  return defaultRagService.getRelevantGuidelines(params);
}
