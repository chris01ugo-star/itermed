/**
 * CLI: ingest specialty medico-legal / economic / clinical docs into Pinecone + Prisma.
 *
 * Expected layout:
 *   knowledge_base/<specialty>/legal|economic|clinical/*.{pdf,md,txt,json,csv}
 *
 * Usage:
 *   npx tsx scripts/ingest-specialty-docs.ts --specialty=cardiologia
 *   npx tsx scripts/ingest-specialty-docs.ts --specialty=cardiologia --update
 *   npx tsx scripts/ingest-specialty-docs.ts --specialty=cardiologia --dry-run
 */
import { openai } from "@ai-sdk/openai";
import { embedMany } from "ai";
import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { basename, extname, join, relative, resolve } from "node:path";
import { extractText } from "unpdf";
import { PrismaClient } from "@prisma/client";
import { getPineconeIndex } from "@/lib/pinecone";
import { sanitizeForExternalAI } from "@/lib/security/sanitize-for-ai";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const prisma = new PrismaClient();

const PINECONE_NAMESPACE = "guidelines";
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;
const EMBED_BATCH = 32;
/** OpenAI embeddings: max 300k tokens/request. ~128×1000-char chunks stay well under. */
const EMBED_INPUT_BATCH = 128;
const DELETE_BATCH = 200;
const SUPPORTED_EXTENSIONS = new Set([".pdf", ".md", ".txt", ".json", ".csv"]);

/** Keep in sync with `lib/services/rag-service.ts`. */
const SIMILARITY_THRESHOLD_LEGAL = 0.7;
const SIMILARITY_THRESHOLD_PROTOCOL = 0.35;
/** Economic RAG threshold (aligned with protocol baseline until a dedicated path exists). */
const SIMILARITY_THRESHOLD_ECONOMIC = SIMILARITY_THRESHOLD_PROTOCOL;

type Pillar = "LEGAL" | "ECONOMIC" | "CLINICAL";

type CliArgs = {
  specialty: string;
  update: boolean;
  dryRun: boolean;
};

type PillarConfig = {
  folder: string;
  pillar: Pillar;
  tags: string[];
  similarityThreshold: number;
  sourceTypeDefault: string;
};

const PILLARS: PillarConfig[] = [
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

type IngestStats = Record<Pillar, { files: number; chunks: number; skipped: number; updated: number }>;

function parseArgs(argv: string[]): CliArgs {
  let specialty = "";
  let update = false;
  let dryRun = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--update") {
      update = true;
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg.startsWith("--specialty=")) {
      specialty = arg.slice("--specialty=".length).trim();
      continue;
    }
    if (arg === "--specialty") {
      specialty = (argv[i + 1] ?? "").trim();
      i += 1;
    }
  }

  if (!specialty) {
    console.error(
      "Usage: npx tsx scripts/ingest-specialty-docs.ts --specialty=<nome> [--update] [--dry-run]\n" +
        "Example: npx tsx scripts/ingest-specialty-docs.ts --specialty=cardiologia --dry-run",
    );
    process.exit(1);
  }

  return { specialty, update, dryRun };
}

/** Prisma / Postgres / Pinecone reject NULs; PDF extractors also emit other C0 controls. */
function stripNullBytes(text: string): string {
  return text.replace(/\u0000/g, "").replace(/\0/g, "").replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g, " ");
}

function chunkText(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
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

function extractYear(source: string, text: string): number | undefined {
  const fromName = source.match(/(?:^|[^\d])((?:19|20)\d{2})(?:[^\d]|$)/);
  if (fromName) return Number(fromName[1]);
  const fromText = text.match(/\b((?:19|20)\d{2})\b/);
  return fromText ? Number(fromText[1]) : undefined;
}

/** Track titles, articles, and commas for LEGAL pillar citations. */
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

/** Parse tariffario CSV / JSON rows into readable € SSN lines when possible. */
function formatEconomicText(raw: string, ext: string): string {
  if (ext === ".json") {
    const text = formatJsonAsText(raw);
    return text
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

async function extractDocumentText(filePath: string): Promise<{ text: string; sourceType: string }> {
  const ext = extname(filePath).toLowerCase();
  const buffer = await readFile(filePath);

  if (ext === ".pdf") {
    const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
    return { text: stripNullBytes(text ?? "").trim(), sourceType: "PDF" };
  }

  const raw = buffer.toString("utf8");
  if (ext === ".json" || ext === ".csv") {
    return { text: formatEconomicText(raw, ext).trim(), sourceType: ext === ".json" ? "JSON" : "CSV" };
  }

  if (ext === ".md") return { text: raw.trim(), sourceType: "MARKDOWN" };
  return { text: raw.trim(), sourceType: "TEXT" };
}

async function listDocuments(dir: string): Promise<string[]> {
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

async function resolveSpecialty(specialtySlug: string) {
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
      console.warn(`    ⚠ embedding retry ${attempt}/3 tra ${waitMs}ms: ${message}`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  throw lastError;
}

async function embedChunks(chunks: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (let i = 0; i < chunks.length; i += EMBED_INPUT_BATCH) {
    const batch = chunks.slice(i, i + EMBED_INPUT_BATCH);
    const batchNo = Math.floor(i / EMBED_INPUT_BATCH) + 1;
    const batchTotal = Math.ceil(chunks.length / EMBED_INPUT_BATCH);
    if (batchTotal > 1) {
      console.log(`    embedding ${batchNo}/${batchTotal} (${batch.length} chunk)`);
    }
    // eslint-disable-next-line no-await-in-loop
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
    // eslint-disable-next-line no-await-in-loop
    await index.deleteMany({
      namespace: PINECONE_NAMESPACE,
      ids: batch,
    });
  }
}

async function removeExistingSource(params: {
  sourceName: string;
  medicalSpecialtyId: string;
  update: boolean;
}): Promise<{ action: "skip" | "create" | "replaced"; existingChunks: number }> {
  const existing = await prisma.guidelineDocument.findFirst({
    where: {
      sourceName: params.sourceName,
      medicalSpecialtyId: params.medicalSpecialtyId,
    },
    select: { id: true, vectorIds: true, title: true, chunkCount: true },
  });

  if (!existing) return { action: "create", existingChunks: 0 };

  if (!params.update) {
    console.log(`  ↷ skip (già presente, usa --update): ${existing.title}`);
    return { action: "skip", existingChunks: existing.chunkCount };
  }

  const ids = Array.isArray(existing.vectorIds) ? (existing.vectorIds as string[]) : [];
  await deleteVectors(ids);
  await prisma.guidelineDocument.delete({ where: { id: existing.id } });
  console.log(`  ♻️  rimossi chunk obsoleti: ${existing.title} (${ids.length} vettori)`);
  return { action: "replaced", existingChunks: existing.chunkCount };
}

async function upsertVectors(
  records: Array<{
    id: string;
    values: number[];
    metadata: Record<string, string | number | boolean | string[]>;
  }>,
): Promise<void> {
  const index = getPineconeIndex();
  if (!index) {
    throw new Error(
      "Pinecone non configurato. Imposta PINECONE_API_KEY e PINECONE_INDEX prima dell'ingestione.",
    );
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      await index.namespace(PINECONE_NAMESPACE).upsert({ records });
      return;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const retryable = /timeout|temporar|ECONNRESET|503|network|reach Pinecone|fetch failed|UND_ERR/i.test(
        message,
      );
      if (!retryable || attempt === 4) throw error;
      const waitMs = attempt * 3000;
      console.warn(`    ⚠ Pinecone upsert retry ${attempt}/4 tra ${waitMs}ms: ${message.slice(0, 180)}`);
      await new Promise((resolveWait) => setTimeout(resolveWait, waitMs));
    }
  }
  throw lastError;
}

async function upsertDocument(params: {
  specialtySlug: string;
  specialtyId: string;
  specialtyName: string;
  pillarCfg: PillarConfig;
  filePath: string;
  knowledgeRoot: string;
  update: boolean;
}): Promise<{ chunks: number; action: "skip" | "create" | "replaced" }> {
  const relativeSource = relative(params.knowledgeRoot, params.filePath).replace(/\\/g, "/");
  const sourceTitle = basename(params.filePath, extname(params.filePath));
  const sourceName = `knowledge_base/${params.specialtySlug}/${relativeSource}`;

  const { action, existingChunks } = await removeExistingSource({
    sourceName,
    medicalSpecialtyId: params.specialtyId,
    update: params.update,
  });
  if (action === "skip") return { chunks: existingChunks, action };

  const { text: extractedText, sourceType } = await extractDocumentText(params.filePath);
  const rawText = stripNullBytes(extractedText);
  if (!rawText || rawText.length < 20) {
    console.warn(`  ⚠ testo insufficiente, salto: ${relativeSource}`);
    return { chunks: 0, action: "skip" };
  }

  const chunks = chunkText(rawText)
    .map((c) => stripNullBytes(sanitizeForExternalAI(c)))
    .filter((c) => c.length > 0);

  if (chunks.length === 0) {
    console.warn(`  ⚠ nessun chunk utile: ${relativeSource}`);
    return { chunks: 0, action: "skip" };
  }

  const index = getPineconeIndex();
  if (!index) {
    throw new Error(
      "Pinecone non configurato. Imposta PINECONE_API_KEY e PINECONE_INDEX prima dell'ingestione.",
    );
  }

  const docId = crypto.randomUUID();
  const updatedAt = new Date().toISOString();
  const year = extractYear(sourceName, rawText);
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
          source: sourceName,
          sourceName,
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

    // eslint-disable-next-line no-await-in-loop
    await upsertVectors(batchRecords);
  }

  await prisma.guidelineDocument.create({
    data: {
      id: docId,
      title: `[${params.pillarCfg.pillar}] ${sourceTitle}`,
      tags,
      sourceType: sourceType || params.pillarCfg.sourceTypeDefault,
      sourceName,
      text: rawText,
      chunkCount: chunks.length,
      vectorIds,
      isActive: true,
      medicalSpecialtyId: params.specialtyId,
    },
  });

  console.log(
    `  ✓ ${params.pillarCfg.pillar.padEnd(9)} ${relativeSource} → ${chunks.length} chunk` +
      ` (soglia RAG ${params.pillarCfg.similarityThreshold})`,
  );

  return { chunks: chunks.length, action };
}

function emptyStats(): IngestStats {
  return {
    LEGAL: { files: 0, chunks: 0, skipped: 0, updated: 0 },
    ECONOMIC: { files: 0, chunks: 0, skipped: 0, updated: 0 },
    CLINICAL: { files: 0, chunks: 0, skipped: 0, updated: 0 },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const specialtySlug = args.specialty.toLowerCase();
  const knowledgeRoot = resolve(process.cwd(), "knowledge_base", specialtySlug);

  console.log("----------------------------------------------------");
  console.log(
    args.dryRun
      ? "🧪 DRY-RUN SPECIALTY DOCS (IO + parsing, no Pinecone/Prisma)"
      : "📥 INGEST SPECIALTY DOCS → Pinecone + Prisma",
  );
  console.log("----------------------------------------------------");
  console.log(`Specialty : ${specialtySlug}`);
  console.log(`Root      : ${knowledgeRoot}`);
  console.log(
    `Mode      : ${
      args.dryRun
        ? "DRY-RUN"
        : args.update
          ? "UPDATE (replace by source)"
          : "CREATE (skip existing)"
    }`,
  );
  console.log(
    `RAG soglie: LEGAL=${SIMILARITY_THRESHOLD_LEGAL} | ECONOMIC=${SIMILARITY_THRESHOLD_ECONOMIC} | CLINICAL=${SIMILARITY_THRESHOLD_PROTOCOL}`,
  );
  console.log("----------------------------------------------------");

  if (!existsSync(knowledgeRoot)) {
    throw new Error(
      `Cartella non trovata: ${knowledgeRoot}\n` +
        `Crea knowledge_base/${specialtySlug}/{legal,economic,clinical}/ e inserisci i documenti.`,
    );
  }

  for (const pillarCfg of PILLARS) {
    const pillarDir = join(knowledgeRoot, pillarCfg.folder);
    if (!existsSync(pillarDir)) {
      throw new Error(
        `Pilastro mancante: ${pillarDir}\n` +
          `Atteso: knowledge_base/${specialtySlug}/{legal,economic,clinical}/`,
      );
    }
  }

  if (args.dryRun) {
    const stats = emptyStats();

    for (const pillarCfg of PILLARS) {
      const pillarDir = join(knowledgeRoot, pillarCfg.folder);
      const files = await listDocuments(pillarDir);
      console.log(`▶ ${pillarCfg.pillar} (${pillarDir}) — ${files.length} file`);

      if (files.length === 0) {
        console.log("  (nessun documento ingestibile)\n");
        continue;
      }

      for (const filePath of files) {
        const relativeSource = relative(knowledgeRoot, filePath).replace(/\\/g, "/");
        // eslint-disable-next-line no-await-in-loop
        const { text, sourceType } = await extractDocumentText(filePath);
        const chunks = text.length >= 20 ? chunkText(text).length : 0;
        stats[pillarCfg.pillar].files += 1;
        stats[pillarCfg.pillar].chunks += chunks;
        if (chunks === 0) {
          stats[pillarCfg.pillar].skipped += 1;
          console.log(`  ⚠ ${relativeSource} (${sourceType}) — testo insufficiente`);
        } else {
          console.log(
            `  ✓ ${relativeSource} (${sourceType}) — ${text.length} chars → ~${chunks} chunk`,
          );
        }
      }
      console.log("");
    }

    console.log("----------------------------------------------------");
    console.log("📊 REPORT DRY-RUN");
    console.log("----------------------------------------------------");
    for (const pillar of ["LEGAL", "ECONOMIC", "CLINICAL"] as Pillar[]) {
      const s = stats[pillar];
      console.log(
        `${pillar.padEnd(9)} file=${s.files}  chunk≈${s.chunks}  skipped=${s.skipped}`,
      );
    }
    console.log("----------------------------------------------------");
    console.log("🎉 DRY-RUN COMPLETATO (nessuna scrittura su Pinecone/Prisma)");
    console.log("----------------------------------------------------");
    return;
  }

  if (!process.env.OPENAI_API_KEY && !process.env.OPENAI_KEY) {
    throw new Error("OPENAI_API_KEY (o OPENAI_KEY) è richiesto per gli embedding.");
  }

  if (!getPineconeIndex()) {
    throw new Error("Pinecone non configurato (PINECONE_API_KEY + PINECONE_INDEX).");
  }

  const specialty = await resolveSpecialty(specialtySlug);
  console.log(`DB specialty match: ${specialty.name} (${specialty.id})\n`);

  const stats = emptyStats();
  const fileRows: Array<{ pillar: Pillar; file: string; chunks: number; action: string }> = [];

  for (const pillarCfg of PILLARS) {
    const pillarDir = join(knowledgeRoot, pillarCfg.folder);
    const files = await listDocuments(pillarDir);

    console.log(`▶ ${pillarCfg.pillar} (${pillarDir}) — ${files.length} file`);

    if (files.length === 0) {
      console.log("  (nessun documento)\n");
      continue;
    }

    for (const filePath of files) {
      const relativeSource = relative(knowledgeRoot, filePath).replace(/\\/g, "/");
      try {
        // eslint-disable-next-line no-await-in-loop
        const result = await upsertDocument({
          specialtySlug,
          specialtyId: specialty.id,
          specialtyName: specialty.name,
          pillarCfg,
          filePath,
          knowledgeRoot,
          update: args.update,
        });

        stats[pillarCfg.pillar].files += 1;
        if (result.action === "skip") {
          stats[pillarCfg.pillar].skipped += 1;
        } else {
          stats[pillarCfg.pillar].chunks += result.chunks;
        }
        if (result.action === "replaced") stats[pillarCfg.pillar].updated += 1;
        fileRows.push({
          pillar: pillarCfg.pillar,
          file: relativeSource,
          chunks: result.chunks,
          action: result.action,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`  ✗ ${relativeSource}: ${message}`);
        stats[pillarCfg.pillar].skipped += 1;
        fileRows.push({
          pillar: pillarCfg.pillar,
          file: relativeSource,
          chunks: 0,
          action: `error: ${message.slice(0, 80)}`,
        });
      }
    }

    console.log("");
  }

  console.log("----------------------------------------------------");
  console.log("📊 REPORT INGESTIONE");
  console.log("----------------------------------------------------");
  for (const pillar of ["LEGAL", "ECONOMIC", "CLINICAL"] as Pillar[]) {
    const s = stats[pillar];
    console.log(
      `${pillar.padEnd(9)} file=${s.files}  chunk=${s.chunks}  skipped=${s.skipped}  updated=${s.updated}`,
    );
  }
  const totalChunks = Object.values(stats).reduce((acc, s) => acc + s.chunks, 0);
  console.log("----------------------------------------------------");
  console.log("📄 CHUNK PER FILE (CLINICAL)");
  console.log("----------------------------------------------------");
  const clinicalRows = fileRows.filter((r) => r.pillar === "CLINICAL");
  const nameWidth = Math.max(24, ...clinicalRows.map((r) => r.file.length));
  console.log(`${"File".padEnd(nameWidth)}  Chunks  Azione`);
  for (const row of clinicalRows) {
    console.log(`${row.file.padEnd(nameWidth)}  ${String(row.chunks).padStart(6)}  ${row.action}`);
  }
  const clinicalTotal = clinicalRows.reduce((acc, r) => acc + r.chunks, 0);
  console.log("----------------------------------------------------");
  console.log(`Totale chunk CLINICAL: ${clinicalTotal}`);
  console.log(`Totale chunk indicizzati in questa run: ${totalChunks}`);
  const errors = fileRows.filter((r) => r.action.startsWith("error"));
  if (errors.length > 0) {
    console.log(`⚠ ${errors.length} file non ingestiti`);
    process.exitCode = 1;
  } else {
    console.log("🎉 INGEST COMPLETATO");
  }
  console.log("----------------------------------------------------");
}

main()
  .catch((error) => {
    console.error("\n❌ Ingest fallito:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
