/**
 * Specialty document ingest: sanitize → chunk → embed → Pinecone + Prisma.
 * Used by `/api/admin/ingest` and the CLI wrapper `scripts/ingest-specialty-docs.ts`.
 */
import { openai } from "@ai-sdk/openai";
import { embedMany } from "ai";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { basename, extname, join, relative, resolve } from "node:path";
import { extractText } from "unpdf";
import { config } from "@/lib/config";
import { createLogger } from "@/lib/logger";
import { getPineconeIndex } from "@/lib/pinecone";
import { prisma } from "@/lib/prisma";
import { sanitizeForExternalAI } from "@/lib/security/sanitize-for-ai";

const logger = createLogger("ingestion-service");

export const PINECONE_GUIDELINES_NAMESPACE = "guidelines";
export const INGEST_CHUNK_SIZE = 1000;
export const INGEST_CHUNK_OVERLAP = 200;

const EMBED_BATCH = 32;
const EMBED_INPUT_BATCH = 128;
const DELETE_BATCH = 200;
const SUPPORTED_EXTENSIONS = new Set([".pdf", ".md", ".txt", ".json", ".csv"]);
const MAX_REMOTE_BYTES = 25 * 1024 * 1024;

/** Keep in sync with `lib/services/rag-service.ts`. */
export const SIMILARITY_THRESHOLD_LEGAL = 0.7;
export const SIMILARITY_THRESHOLD_PROTOCOL = 0.35;
export const SIMILARITY_THRESHOLD_ECONOMIC = SIMILARITY_THRESHOLD_PROTOCOL;

export type IngestPillar = "LEGAL" | "ECONOMIC" | "CLINICAL";

export type PillarConfig = {
  folder: string;
  pillar: IngestPillar;
  tags: string[];
  similarityThreshold: number;
  sourceTypeDefault: string;
};

export const INGEST_PILLARS: PillarConfig[] = [
  {
    folder: "legal",
    pillar: "LEGAL",
    tags: ["legale", "medico-legale", "normativa", "pillaro-legal"],
    similarityThreshold: SIMILARITY_THRESHOLD_LEGAL,
    sourceTypeDefault: "PDF",
  },
  {
    folder: "economic",
    pillar: "ECONOMIC",
    tags: ["economico", "tariffario", "ssn", "pillaro-economic"],
    similarityThreshold: SIMILARITY_THRESHOLD_ECONOMIC,
    sourceTypeDefault: "TEXT",
  },
  {
    folder: "clinical",
    pillar: "CLINICAL",
    tags: ["protocollo", "linee guida", "linee-guida", "pillaro-clinical"],
    similarityThreshold: SIMILARITY_THRESHOLD_PROTOCOL,
    sourceTypeDefault: "PDF",
  },
];

const PILLAR_BY_NAME = new Map(INGEST_PILLARS.map((p) => [p.pillar, p]));

export type IngestAction = "skip" | "create" | "replaced";

export type IngestDocumentResult = {
  sourceName: string;
  chunks: number;
  action: IngestAction;
  docId?: string;
};

export type IngestStats = Record<
  IngestPillar,
  { files: number; chunks: number; skipped: number; updated: number }
>;

export type IngestRunResult = {
  specialty: string;
  specialtyId?: string;
  dryRun: boolean;
  documents: number;
  chunks: number;
  skipped: number;
  updated: number;
  errors: Array<{ file: string; error: string }>;
  stats: IngestStats;
};

export type IngestProgressFn = (progress: number, message: string) => void | Promise<void>;

export type IngestBufferInput = {
  specialty: string;
  buffer: Buffer;
  filename: string;
  pillar?: IngestPillar;
  sourceUrl?: string;
  title?: string;
  update?: boolean;
  dryRun?: boolean;
};

export type IngestUrlInput = {
  specialty: string;
  sourceUrl: string;
  pillar?: IngestPillar;
  filename?: string;
  title?: string;
  update?: boolean;
  dryRun?: boolean;
};

export type IngestDiskInput = {
  specialty: string;
  update?: boolean;
  dryRun?: boolean;
  onProgress?: IngestProgressFn;
};

type PineconeRecord = {
  id: string;
  values: number[];
  metadata: Record<string, string | number | boolean | string[]>;
};

/** Prisma / Postgres / Pinecone reject NULs; PDF extractors also emit other C0 controls. */
export function stripNullBytes(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/\0/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g, " ");
}

export function chunkText(
  text: string,
  size = INGEST_CHUNK_SIZE,
  overlap = INGEST_CHUNK_OVERLAP,
): string[] {
  const normalized = stripNullBytes(text.replace(/\r\n/g, "\n")).trim();
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

    const trimmed = chunk.trim();
    if (trimmed) chunks.push(trimmed);
    if (end >= normalized.length) break;
    start = Math.max(0, end - overlap);
    if (start >= end) start = end;
  }

  return chunks;
}

export function emptyIngestStats(): IngestStats {
  return {
    LEGAL: { files: 0, chunks: 0, skipped: 0, updated: 0 },
    ECONOMIC: { files: 0, chunks: 0, skipped: 0, updated: 0 },
    CLINICAL: { files: 0, chunks: 0, skipped: 0, updated: 0 },
  };
}

export function resolvePillar(raw?: string | null): IngestPillar {
  const value = (raw ?? "CLINICAL").trim().toUpperCase();
  if (value === "LEGAL" || value === "ECONOMIC" || value === "CLINICAL") return value;
  throw new Error(`Pilastro non valido: ${raw}. Atteso LEGAL | ECONOMIC | CLINICAL.`);
}

function extractYear(source: string, text: string): number | undefined {
  const fromName = source.match(/(?:^|[^\d])((?:19|20)\d{2})(?:[^\d]|$)/);
  if (fromName) return Number(fromName[1]);
  const fromText = text.match(/\b((?:19|20)\d{2})\b/);
  return fromText ? Number(fromText[1]) : undefined;
}

function extractLegalMetadata(chunk: string): { article?: string; section?: string } {
  const articleMatch = chunk.match(
    /\b(?:Art(?:icolo|\.)?|ART(?:ICOLO|\.)?)\s*(\d+(?:[- ]?(?:bis|ter|quater|quinquies))?)/i,
  );
  const commaMatch = chunk.match(/\bcomm[ao]\s*(\d+)/i);
  const sectionMatch = chunk.match(/\b(?:Sez(?:ione|\.)?|Capo|Titolo)\s+([IVXLC\d]+[A-Za-z0-9.-]*)/i);

  const article = articleMatch
    ? commaMatch
      ? `Art. ${articleMatch[1]} comma ${commaMatch[1]}`
      : `Art. ${articleMatch[1]}`
    : undefined;

  return {
    article,
    section: sectionMatch ? sectionMatch[0].trim() : undefined,
  };
}

function formatJsonAsText(raw: string): string {
  try {
    const data = JSON.parse(raw) as unknown;
    if (Array.isArray(data)) {
      return data
        .map((row, i) => {
          if (row && typeof row === "object") {
            return Object.entries(row as Record<string, unknown>)
              .map(([k, v]) => `${k}: ${String(v)}`)
              .join(" | ");
          }
          return `item_${i}: ${String(row)}`;
        })
        .join("\n");
    }
    if (data && typeof data === "object") {
      return Object.entries(data as Record<string, unknown>)
        .map(([k, v]) => {
          if (v && typeof v === "object") return `${k}:\n${JSON.stringify(v, null, 2)}`;
          return `${k}: ${String(v)}`;
        })
        .join("\n");
    }
    return String(data);
  } catch {
    return raw;
  }
}

function formatEconomicText(raw: string, ext: string): string {
  if (ext === ".json") {
    return formatJsonAsText(raw)
      .replace(/\b(price|costo|tariffa|importo|prezzo|euro|eur)\b/gi, (m) => `${m} (€ SSN)`)
      .trim();
  }

  if (ext === ".csv") {
    const lines = raw.replace(/\r\n/g, "\n").trim().split("\n");
    if (lines.length === 0) return "";
    const headers = lines[0].split(/[,;]/).map((h) => h.trim().replace(/^"|"$/g, ""));
    return lines
      .slice(1)
      .map((line) => {
        const cols = line.split(/[,;]/).map((c) => c.trim().replace(/^"|"$/g, ""));
        return headers
          .map((h, i) => {
            const value = cols[i] ?? "";
            const isMoney = /price|costo|tariffa|importo|prezzo|euro|eur/i.test(h);
            return `${h}: ${value}${isMoney && value ? " € SSN" : ""}`;
          })
          .join(" | ");
      })
      .filter(Boolean)
      .join("\n");
  }

  return raw;
}

export function extractTextFromBuffer(
  buffer: Buffer,
  filename: string,
): { text: string; sourceType: string } {
  const ext = extname(filename).toLowerCase();

  if (ext === ".pdf") {
    throw new Error("PDF extraction is async — use extractTextFromBufferAsync.");
  }

  const raw = buffer.toString("utf8");
  if (ext === ".json" || ext === ".csv") {
    return { text: formatEconomicText(raw, ext).trim(), sourceType: ext === ".json" ? "JSON" : "CSV" };
  }
  if (ext === ".md") return { text: raw.trim(), sourceType: "MARKDOWN" };
  return { text: raw.trim(), sourceType: "TEXT" };
}

export async function extractTextFromBufferAsync(
  buffer: Buffer,
  filename: string,
): Promise<{ text: string; sourceType: string }> {
  const ext = extname(filename).toLowerCase() || guessExtFromBuffer(buffer);

  if (ext === ".pdf") {
    const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
    return { text: stripNullBytes(text ?? "").trim(), sourceType: "PDF" };
  }

  return extractTextFromBuffer(buffer, filename || `document${ext}`);
}

function guessExtFromBuffer(buffer: Buffer): string {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("utf8") === "%PDF-") return ".pdf";
  return ".txt";
}

function sanitizeFilename(filename: string): string {
  const base = basename(filename.replace(/\\/g, "/")).replace(/[^\w.\- ()àèéìòù]+/gi, "_");
  return base || "document.bin";
}

export async function listDocuments(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listDocuments(full)));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!SUPPORTED_EXTENSIONS.has(extname(entry.name).toLowerCase())) continue;
    files.push(full);
  }

  return files.sort();
}

export async function resolveMedicalSpecialty(specialtySlug: string): Promise<{
  id: string;
  name: string;
}> {
  const specialties = await prisma.medicalSpecialty.findMany({
    select: { id: true, name: true },
  });

  const needle = specialtySlug.trim().toLowerCase().replace(/[_-]+/g, " ");
  const match = specialties.find((s) => {
    const name = s.name.toLowerCase();
    const compact = name.replace(/\s+/g, "");
    return (
      name === needle ||
      compact === needle.replace(/\s+/g, "") ||
      name.includes(needle) ||
      needle.includes(name)
    );
  });

  if (!match) {
    throw new Error(
      `Specialità "${specialtySlug}" non trovata in MedicalSpecialty. ` +
        `Disponibili: ${specialties.map((s) => s.name).join(", ") || "(nessuna)"}`,
    );
  }

  return match;
}

async function embedManyWithRetry(values: string[]): Promise<number[][]> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const { embeddings } = await embedMany({
        model: openai.embedding("text-embedding-3-small"),
        values,
      });
      return embeddings;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const retryable = /timeout|429|rate|temporar|ECONNRESET|503|overloaded/i.test(message);
      if (!retryable || attempt === 3) throw error;
      const waitMs = attempt * 2000;
      logger.warn("Embedding retry", { attempt, waitMs, message });
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }

  throw lastError;
}

async function embedChunks(chunks: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (let i = 0; i < chunks.length; i += EMBED_INPUT_BATCH) {
    const batch = chunks.slice(i, i + EMBED_INPUT_BATCH);
    const batchEmbeddings = await embedManyWithRetry(batch);
    embeddings.push(...batchEmbeddings);
  }

  return embeddings;
}

async function deleteVectors(vectorIds: string[]): Promise<void> {
  const index = getPineconeIndex();
  if (!index || vectorIds.length === 0) return;

  for (let i = 0; i < vectorIds.length; i += DELETE_BATCH) {
    const batch = vectorIds.slice(i, i + DELETE_BATCH);
    await index.deleteMany({
      namespace: PINECONE_GUIDELINES_NAMESPACE,
      ids: batch,
    });
  }
}

async function upsertVectors(records: PineconeRecord[]): Promise<void> {
  const index = getPineconeIndex();
  if (!index) {
    throw new Error(
      "Pinecone non configurato. Imposta PINECONE_API_KEY e PINECONE_INDEX prima dell'ingestione.",
    );
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      await index.namespace(PINECONE_GUIDELINES_NAMESPACE).upsert({ records });
      return;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const retryable = /timeout|temporar|ECONNRESET|503|network|reach Pinecone|fetch failed|UND_ERR/i.test(
        message,
      );
      if (!retryable || attempt === 4) throw error;
      const waitMs = attempt * 3000;
      logger.warn("Pinecone upsert retry", { attempt, waitMs, message: message.slice(0, 180) });
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw lastError;
}

async function removeExistingSource(params: {
  sourceName: string;
  medicalSpecialtyId: string;
  update: boolean;
}): Promise<{ action: IngestAction; existingChunks: number }> {
  const existing = await prisma.guidelineDocument.findFirst({
    where: {
      sourceName: params.sourceName,
      medicalSpecialtyId: params.medicalSpecialtyId,
    },
    select: { id: true, vectorIds: true, title: true, chunkCount: true },
  });

  if (!existing) return { action: "create", existingChunks: 0 };

  if (!params.update) {
    logger.info("Skip existing source (pass update=true to replace)", {
      title: existing.title,
      sourceName: params.sourceName,
    });
    return { action: "skip", existingChunks: existing.chunkCount };
  }

  const ids = Array.isArray(existing.vectorIds) ? (existing.vectorIds as string[]) : [];
  await deleteVectors(ids);
  await prisma.guidelineDocument.delete({ where: { id: existing.id } });
  logger.info("Removed obsolete vectors", { title: existing.title, vectors: ids.length });
  return { action: "replaced", existingChunks: existing.chunkCount };
}

function prepareChunks(rawText: string): string[] {
  const sanitized = stripNullBytes(rawText);
  return chunkText(sanitized)
    .map((c) => stripNullBytes(sanitizeForExternalAI(c)))
    .filter((c) => c.length > 0);
}

async function persistDocument(params: {
  specialtySlug: string;
  specialtyId: string;
  specialtyName: string;
  pillarCfg: PillarConfig;
  filename: string;
  sourceName: string;
  rawText: string;
  sourceType: string;
  update: boolean;
  dryRun?: boolean;
}): Promise<IngestDocumentResult> {
  const sourceTitle =
    params.filename.replace(/\.[^.]+$/, "") || basename(params.sourceName).replace(/\.[^.]+$/, "");

  if (params.dryRun) {
    const chunks = prepareChunks(params.rawText);
    return { sourceName: params.sourceName, chunks: chunks.length, action: "create" };
  }

  const { action, existingChunks } = await removeExistingSource({
    sourceName: params.sourceName,
    medicalSpecialtyId: params.specialtyId,
    update: params.update,
  });
  if (action === "skip") {
    return { sourceName: params.sourceName, chunks: existingChunks, action };
  }

  const rawText = stripNullBytes(params.rawText);
  if (!rawText || rawText.length < 20) {
    logger.warn("Insufficient extracted text", { sourceName: params.sourceName });
    return { sourceName: params.sourceName, chunks: 0, action: "skip" };
  }

  const chunks = prepareChunks(rawText);
  if (chunks.length === 0) {
    logger.warn("No usable chunks", { sourceName: params.sourceName });
    return { sourceName: params.sourceName, chunks: 0, action: "skip" };
  }

  if (!config.isPineconeConfigured || !getPineconeIndex()) {
    throw new Error("Pinecone non configurato (PINECONE_API_KEY + PINECONE_INDEX).");
  }

  const docId = crypto.randomUUID();
  const updatedAt = new Date().toISOString();
  const year = extractYear(params.sourceName, rawText);
  const tags = [...params.pillarCfg.tags, params.specialtySlug.toLowerCase()];
  const embeddings = await embedChunks(chunks);
  const vectorIds = embeddings.map((_, i) => `${docId}-${i}`);

  for (let i = 0; i < embeddings.length; i += EMBED_BATCH) {
    const batchRecords = embeddings.slice(i, i + EMBED_BATCH).map((vector, localIndex) => {
      const globalIndex = i + localIndex;
      const chunkId = vectorIds[globalIndex];
      const legalMeta =
        params.pillarCfg.pillar === "LEGAL" ? extractLegalMetadata(chunks[globalIndex]) : {};

      return {
        id: chunkId,
        values: vector,
        metadata: {
          documentId: docId,
          title: sourceTitle,
          tags,
          content: chunks[globalIndex],
          source: params.sourceName,
          sourceName: params.sourceName,
          sourceTitle,
          specialty: params.specialtyName,
          medicalSpecialtyId: params.specialtyId,
          pillar: params.pillarCfg.pillar,
          chunkId,
          updatedAt,
          similarityThreshold: params.pillarCfg.similarityThreshold,
          ...(year != null ? { year } : {}),
          ...(legalMeta.article ? { article: legalMeta.article } : {}),
          ...(legalMeta.section ? { section: legalMeta.section } : {}),
        },
      };
    });

    await upsertVectors(batchRecords);
  }

  await prisma.guidelineDocument.create({
    data: {
      id: docId,
      title: `[${params.pillarCfg.pillar}] ${sourceTitle}`,
      tags,
      sourceType: params.sourceType || params.pillarCfg.sourceTypeDefault,
      sourceName: params.sourceName,
      text: rawText,
      chunkCount: chunks.length,
      vectorIds,
      isActive: true,
      medicalSpecialtyId: params.specialtyId,
    },
  });

  logger.info("Indexed document", {
    pillar: params.pillarCfg.pillar,
    sourceName: params.sourceName,
    chunks: chunks.length,
  });

  return { sourceName: params.sourceName, chunks: chunks.length, action, docId };
}

export async function ingestDocumentFromBuffer(
  input: IngestBufferInput,
): Promise<IngestDocumentResult> {
  const specialtySlug = input.specialty.trim().toLowerCase();
  const filename = sanitizeFilename(input.filename);
  const pillar = input.pillar ?? "CLINICAL";
  const pillarCfg = PILLAR_BY_NAME.get(pillar);
  if (!pillarCfg) throw new Error(`Pilastro sconosciuto: ${pillar}`);

  const { text, sourceType } = await extractTextFromBufferAsync(input.buffer, filename);
  const sourceName =
    input.sourceUrl?.trim() || `upload/${specialtySlug}/${pillarCfg.folder}/${filename}`;

  if (input.dryRun) {
    const chunks = prepareChunks(text);
    return { sourceName, chunks: chunks.length, action: "create" };
  }

  const specialty = await resolveMedicalSpecialty(specialtySlug);
  return persistDocument({
    specialtySlug,
    specialtyId: specialty.id,
    specialtyName: specialty.name,
    pillarCfg,
    filename,
    sourceName,
    rawText: text,
    sourceType,
    update: Boolean(input.update),
  });
}

export async function ingestDocumentFromUrl(input: IngestUrlInput): Promise<IngestDocumentResult> {
  const parsed = new URL(input.sourceUrl);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("URL non valido: sono ammessi solo http/https.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  let response: Response;
  try {
    response = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: { Accept: "application/pdf, text/plain, text/markdown, application/json, text/csv, */*" },
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Download fallito (${response.status}) da ${parsed.toString()}`);
  }

  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (contentLength > MAX_REMOTE_BYTES) {
    throw new Error(`File remoto troppo grande (${contentLength} byte, max ${MAX_REMOTE_BYTES}).`);
  }

  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_REMOTE_BYTES) {
    throw new Error(`File remoto troppo grande (${arrayBuffer.byteLength} byte).`);
  }

  const urlName = sanitizeFilename(parsed.pathname) || "remote-document";
  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
  let filename = input.filename ? sanitizeFilename(input.filename) : urlName;
  if (!extname(filename)) {
    if (contentType.includes("pdf")) filename = `${filename}.pdf`;
    else if (contentType.includes("json")) filename = `${filename}.json`;
    else if (contentType.includes("csv")) filename = `${filename}.csv`;
    else if (contentType.includes("markdown")) filename = `${filename}.md`;
    else filename = `${filename}.txt`;
  }

  return ingestDocumentFromBuffer({
    specialty: input.specialty,
    buffer: Buffer.from(arrayBuffer),
    filename,
    pillar: input.pillar,
    sourceUrl: parsed.toString(),
    title: input.title,
    update: input.update,
    dryRun: input.dryRun,
  });
}

export async function ingestSpecialtyFromDisk(input: IngestDiskInput): Promise<IngestRunResult> {
  const specialtySlug = input.specialty.trim().toLowerCase();
  const knowledgeRoot = resolve(process.cwd(), "knowledge_base", specialtySlug);
  const stats = emptyIngestStats();
  const errors: Array<{ file: string; error: string }> = [];

  if (!existsSync(knowledgeRoot)) {
    throw new Error(
      `Cartella non trovata: ${knowledgeRoot}\n` +
        `Crea knowledge_base/${specialtySlug}/{legal,economic,clinical}/ e inserisci i documenti.`,
    );
  }

  for (const pillarCfg of INGEST_PILLARS) {
    const pillarDir = join(knowledgeRoot, pillarCfg.folder);
    if (!existsSync(pillarDir)) {
      throw new Error(
        `Pilastro mancante: ${pillarDir}\n` +
          `Atteso: knowledge_base/${specialtySlug}/{legal,economic,clinical}/`,
      );
    }
  }

  const allFiles: Array<{ pillarCfg: PillarConfig; filePath: string }> = [];
  for (const pillarCfg of INGEST_PILLARS) {
    const files = await listDocuments(join(knowledgeRoot, pillarCfg.folder));
    for (const filePath of files) allFiles.push({ pillarCfg, filePath });
  }

  const report: IngestRunResult = {
    specialty: specialtySlug,
    dryRun: Boolean(input.dryRun),
    documents: 0,
    chunks: 0,
    skipped: 0,
    updated: 0,
    errors,
    stats,
  };

  if (input.dryRun) {
    for (let i = 0; i < allFiles.length; i += 1) {
      const { pillarCfg, filePath } = allFiles[i];
      const relativeSource = relative(knowledgeRoot, filePath).replace(/\\/g, "/");
      await input.onProgress?.(
        Math.round(((i + 1) / Math.max(allFiles.length, 1)) * 100),
        `Dry-run ${relativeSource}`,
      );
      const buffer = await readFile(filePath);
      const { text } = await extractTextFromBufferAsync(buffer, basename(filePath));
      const chunks = text.length >= 20 ? chunkText(text).length : 0;
      stats[pillarCfg.pillar].files += 1;
      stats[pillarCfg.pillar].chunks += chunks;
      if (chunks === 0) stats[pillarCfg.pillar].skipped += 1;
      report.documents += 1;
      report.chunks += chunks;
      if (chunks === 0) report.skipped += 1;
    }
    return report;
  }

  const specialty = await resolveMedicalSpecialty(specialtySlug);
  report.specialtyId = specialty.id;

  for (let i = 0; i < allFiles.length; i += 1) {
    const { pillarCfg, filePath } = allFiles[i];
    const relativeSource = relative(knowledgeRoot, filePath).replace(/\\/g, "/");
    const sourceName = `knowledge_base/${specialtySlug}/${relativeSource}`;
    await input.onProgress?.(
      Math.min(95, Math.round(((i + 1) / Math.max(allFiles.length, 1)) * 90) + 5),
      `Ingestione ${relativeSource}`,
    );

    try {
      const buffer = await readFile(filePath);
      const { text, sourceType } = await extractTextFromBufferAsync(buffer, basename(filePath));
      const result = await persistDocument({
        specialtySlug,
        specialtyId: specialty.id,
        specialtyName: specialty.name,
        pillarCfg,
        filename: basename(filePath),
        sourceName,
        rawText: text,
        sourceType,
        update: Boolean(input.update),
      });

      stats[pillarCfg.pillar].files += 1;
      report.documents += 1;
      if (result.action === "skip") {
        stats[pillarCfg.pillar].skipped += 1;
        report.skipped += 1;
      } else {
        stats[pillarCfg.pillar].chunks += result.chunks;
        report.chunks += result.chunks;
      }
      if (result.action === "replaced") {
        stats[pillarCfg.pillar].updated += 1;
        report.updated += 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Document ingest failed", { file: relativeSource, error });
      stats[pillarCfg.pillar].skipped += 1;
      report.skipped += 1;
      errors.push({ file: relativeSource, error: message });
    }
  }

  return report;
}
