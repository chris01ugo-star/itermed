import { openai } from "@ai-sdk/openai";
import { embedMany } from "ai";
import { z } from "zod";
import { config } from "@/lib/config";
import { createLogger } from "@/lib/logger";
import { getPineconeIndex } from "@/lib/pinecone";
import { requireAdminApi } from "@/lib/require-admin-api";
import { prisma } from "@/lib/prisma";
import { sanitizeForExternalAI } from "@/lib/security/sanitize-for-ai";

const ingestGuidelinesLogger = createLogger("ingest-guidelines");

const IngestBodySchema = z.object({
  title: z.string().min(1),
  text: z.string().min(1),
  tags: z.array(z.string()).optional(),
  /** Canonical MedicalSpecialty.id — scopes the document for specialty-centric RAG. */
  medicalSpecialtyId: z.string().min(1).optional(),
});

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 120;

export async function POST(req: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const index = getPineconeIndex();
  if (!index || !config.isPineconeConfigured) {
    return new Response(
      JSON.stringify({
        error:
          "Pinecone non è configurato. Imposta PINECONE_API_KEY e PINECONE_INDEX per usare l'ingestion.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const json = await req.json();
  const parsed = IngestBodySchema.safeParse(json);

  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { title, text, tags = [], medicalSpecialtyId } = parsed.data;

  if (medicalSpecialtyId) {
    const specialty = await prisma.medicalSpecialty.findUnique({
      where: { id: medicalSpecialtyId },
      select: { id: true },
    });
    if (!specialty) {
      return new Response(JSON.stringify({ error: "medicalSpecialtyId non valido." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // 1. Chunking semplice a lunghezza fissa con overlap
  const normalized = text.replace(/\r\n/g, "\n").trim();
  const chunks: string[] = [];

  let start = 0;
  while (start < normalized.length) {
    const end = Math.min(start + CHUNK_SIZE, normalized.length);
    let chunk = normalized.slice(start, end);

    // evita di troncare in mezzo a una frase quando possibile
    if (end < normalized.length) {
      const lastPeriod = chunk.lastIndexOf(".");
      if (lastPeriod > CHUNK_SIZE * 0.6) {
        chunk = chunk.slice(0, lastPeriod + 1);
      }
    }

    chunks.push(chunk.trim());
    if (end === normalized.length) break;
    start = end - CHUNK_OVERLAP;
  }

  const sanitizedChunks = chunks
    .map((chunk) => sanitizeForExternalAI(chunk))
    .filter((chunk) => chunk.length > 0);

  if (sanitizedChunks.length === 0) {
    return new Response(
      JSON.stringify({ error: "Nessun contenuto valido da indicizzare." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    // 2. Embedding dei chunk
    const { embeddings } = await embedMany({
      model: openai.embedding("text-embedding-3-small"),
      values: sanitizedChunks,
    });

    // 3. Upsert su Pinecone
    const namespace = "guidelines";
    const docId = crypto.randomUUID();
    const vectorIds = embeddings.map((_, i) => `${docId}-${i}`);

    const records = embeddings.map((vector, i) => ({
      id: vectorIds[i],
      values: vector,
      metadata: {
        documentId: docId,
        title,
        tags,
        content: sanitizedChunks[i],
        ...(medicalSpecialtyId ? { medicalSpecialtyId } : {}),
      },
    }));

    if (records.length === 0) {
      return new Response(
        JSON.stringify({
          error:
            "Nessun vettore valido generato per l'indicizzazione. Verifica che il testo non sia vuoto o troppo corto.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    try {
      ingestGuidelinesLogger.info("Pinecone guidelines upsert", { recordCount: records.length });
      await index.namespace(namespace).upsert({ records });
    } catch (err: unknown) {
      ingestGuidelinesLogger.error("Pinecone upsert failed for guidelines", { error: err });
      return new Response(
        JSON.stringify({
          status: "partial",
          chunks: sanitizedChunks.length,
          warning:
            "Testo elaborato ma non indicizzato correttamente in Pinecone. Verifica configurazione Pinecone/SDK.",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    await prisma.guidelineDocument.create({
      data: {
        id: docId,
        title,
        tags,
        sourceType: "TEXT",
        text: normalized,
        chunkCount: sanitizedChunks.length,
        vectorIds,
        isActive: true,
        ...(medicalSpecialtyId ? { medicalSpecialtyId } : {}),
      },
    });

    return new Response(
      JSON.stringify({
        status: "ok",
        chunks: sanitizedChunks.length,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error:
          error?.message ??
          "Errore imprevisto durante l'embedding del testo o l'upsert in Pinecone.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

