import { openai } from "@ai-sdk/openai";
import { embedMany } from "ai";
import { extractText } from "unpdf";
import { z } from "zod";
import { config } from "@/lib/config";
import { createLogger } from "@/lib/logger";
import { getPineconeIndex } from "@/lib/pinecone";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/require-admin-api";
import { sanitizeForExternalAI } from "@/lib/security/sanitize-for-ai";

export const runtime = "nodejs";

const ingestPdfLogger = createLogger("ingest-pdf");

const FormSchema = z.object({
  title: z.string().min(1),
  tags: z.string().optional(),
  medicalSpecialtyId: z.string().min(1).optional(),
});

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

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

async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
    return text.trim();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Errore durante l'estrazione del testo dal PDF. Il file potrebbe essere corrotto, protetto da password o non supportato. Dettaglio: ${detail}`,
    );
  }
}

export async function POST(req: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const pineconeConfigured = config.isPineconeConfigured;
  const index = pineconeConfigured ? getPineconeIndex() : null;

  if (!pineconeConfigured || !index) {
    ingestPdfLogger.warn(
      "Pinecone not configured or index unavailable; PDF will be saved to Prisma only",
    );
  }

  try {
    const formData = await req.formData();
    const rawTitle = formData.get("title");
    const rawTags = formData.get("tags");
    const rawSpecialtyId = formData.get("medicalSpecialtyId");
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: "File PDF mancante." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const parsedMeta = FormSchema.safeParse({
      title: typeof rawTitle === "string" ? rawTitle : "",
      tags: typeof rawTags === "string" ? rawTags : "",
      medicalSpecialtyId:
        typeof rawSpecialtyId === "string" && rawSpecialtyId.trim()
          ? rawSpecialtyId.trim()
          : undefined,
    });

    if (!parsedMeta.success) {
      return new Response(JSON.stringify({ error: parsedMeta.error.flatten() }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { title, tags, medicalSpecialtyId } = parsedMeta.data;

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
    const tagsArray = tags
      ? tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const rawText = await extractPdfText(buffer);

    if (!rawText || rawText.length < 20) {
      return new Response(
        JSON.stringify({
          error:
            "Impossibile estrarre testo dal PDF. Il documento potrebbe essere solo un'immagine scannerizzata senza OCR.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const chunks = chunkText(rawText)
      .map((chunk) => sanitizeForExternalAI(chunk))
      .filter((chunk) => chunk.length > 0);
    if (chunks.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Nessun contenuto utile estratto dal PDF.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const docId = crypto.randomUUID();
    let vectorIds: string[] = [];

    if (pineconeConfigured && index) {
      const { embeddings } = await embedMany({
        model: openai.embedding("text-embedding-3-small"),
        values: chunks,
      });

      const namespace = "guidelines";
      vectorIds = embeddings.map((_, i) => `${docId}-${i}`);
      const BATCH_SIZE = 64;

      for (let i = 0; i < embeddings.length; i += BATCH_SIZE) {
        const batchRecords = embeddings.slice(i, i + BATCH_SIZE).map((vector, localIndex) => {
          const globalIndex = i + localIndex;
          return {
            id: vectorIds[globalIndex],
            values: vector,
            metadata: {
              documentId: docId,
              title,
              tags: tagsArray,
              content: chunks[globalIndex],
              source: file.name,
              ...(medicalSpecialtyId ? { medicalSpecialtyId } : {}),
            },
          };
        });

        if (batchRecords.length === 0) {
          continue;
        }

        ingestPdfLogger.info("Pinecone PDF upsert batch", { batchSize: batchRecords.length });
        await index.namespace(namespace).upsert({ records: batchRecords });
      }
    }

    await prisma.guidelineDocument.create({
      data: {
        id: docId,
        title,
        tags: tagsArray,
        sourceType: "PDF",
        sourceName: file.name,
        text: rawText,
        chunkCount: chunks.length,
        vectorIds,
        isActive: pineconeConfigured && index ? true : false,
        ...(medicalSpecialtyId ? { medicalSpecialtyId } : {}),
      },
    });

    return new Response(
      JSON.stringify({
        status: "ok",
        chunks: chunks.length,
        indexed: Boolean(pineconeConfigured && index),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    ingestPdfLogger.error("PDF ingest failed", { error });
    const message =
      error instanceof Error
        ? error.message
        : "Errore imprevisto durante l'analisi del PDF e il salvataggio.";

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
