/**
 * CLI wrapper around `lib/services/ingestion-service`.
 *
 * Expected layout:
 *   knowledge_base/<specialty>/legal|economic|clinical/*.{pdf,md,txt,json,csv}
 *   Un pilastro assente (es. cardiologia/economic) produce un warning e non blocca gli altri.
 *   knowledge_base/generale/legal|economic/*  (corpus legale/economico condiviso)
 *   knowledge_base/empatia/                    (protocolli di comunicazione)
 *
 * `generale` e `empatia` non sono righe MedicalSpecialty. Il metadata Pinecone
 * `specialty` è lo slug ("generale" o "empatia").
 * Le altre cartelle canoniche, inclusa `reumatologia`, fanno upsert della riga
 * `MedicalSpecialty` quando non è un dry-run.
 *
 * Usage:
 *   npx tsx scripts/ingest-specialty-docs.ts --specialty=cardiologia
 *   npx tsx scripts/ingest-specialty-docs.ts --specialty=generale --update
 *   npx tsx scripts/ingest-specialty-docs.ts --specialty=empatia --update
 *   npx tsx scripts/ingest-specialty-docs.ts --specialty=cardiologia --dry-run
 *   npx tsx scripts/ingest-specialty-docs.ts --all
 *   npx tsx scripts/ingest-specialty-docs.ts --all --dry-run
 *
 * Default mode skips documents already stored for the same source path
 * before opening the file. `placeholder.*` files are ignored.
 * `clinic/` is read as the clinical pillar.
 */
import { config as loadEnv } from "dotenv";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env") });
loadEnv({ path: resolve(process.cwd(), ".env.local"), override: true });

const SKIPPED_KNOWLEDGE_DIRS = new Set(["cases", "tutorials"]);

type CliArgs = {
  specialties: string[];
  update: boolean;
  dryRun: boolean;
};

type IngestRunResult = {
  documents: number;
  chunks: number;
  skipped: number;
  errors: Array<{ file: string; error: string }>;
  stats: Record<string, { files: number; chunks: number; skipped: number; updated: number }>;
};

function listKnowledgeBaseSpecialties(): string[] {
  const root = resolve(process.cwd(), "knowledge_base");
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !SKIPPED_KNOWLEDGE_DIRS.has(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function parseArgs(argv: string[]): CliArgs {
  let specialty = "";
  let all = false;
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
    if (arg === "--all") {
      all = true;
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

  if (!specialty && !all) {
    console.error(
      "Usage: npx tsx scripts/ingest-specialty-docs.ts (--specialty=<nome> | --all) [--update] [--dry-run]\n" +
        "Example: npx tsx scripts/ingest-specialty-docs.ts --all\n" +
        "         npx tsx scripts/ingest-specialty-docs.ts --specialty=cardiologia --dry-run",
    );
    process.exit(1);
  }

  const specialties = all ? listKnowledgeBaseSpecialties() : [specialty.toLowerCase()];

  if (specialties.length === 0) {
    console.error("Nessuna cartella specialità in knowledge_base/.");
    process.exit(1);
  }

  return { specialties, update, dryRun };
}

function envStatus(value: string | undefined): "OK" | "MISS" {
  return value && value.trim() ? "OK" : "MISS";
}

function printEnvCheck(): { openai: "OK" | "MISS"; pinecone: "OK" | "MISS" } {
  const db = envStatus(
    process.env.DATABASE_URL || process.env.DATABASE_POOL_URL || process.env.POSTGRES_URL,
  );
  const openai = envStatus(process.env.OPENAI_API_KEY || process.env.OPENAI_KEY);
  const indexName = process.env.PINECONE_INDEX?.trim() || "";
  const pinecone = envStatus(process.env.PINECONE_API_KEY) === "OK" && indexName ? "OK" : "MISS";
  console.log(
    `ENV check: DB=${db}, OpenAI=${openai}, Pinecone=${pinecone} (index=${indexName || "missing"})`,
  );
  return { openai, pinecone };
}

function printSpecialtyReport(specialty: string, result: IngestRunResult, dryRun: boolean): boolean {
  console.log("----------------------------------------------------");
  console.log(dryRun ? `📊 DRY-RUN ${specialty}` : `📊 INGESTIONE ${specialty}`);
  console.log("----------------------------------------------------");
  for (const pillar of ["LEGAL", "ECONOMIC", "CLINICAL"]) {
    const stats = result.stats[pillar];
    if (!stats) continue;
    console.log(
      `${pillar.padEnd(9)} file=${stats.files}  chunk=${stats.chunks}  skipped=${stats.skipped}  updated=${stats.updated}`,
    );
  }
  console.log(`Documenti: ${result.documents}  chunk=${result.chunks}  skipped=${result.skipped}`);
  if (result.errors.length === 0) return false;
  console.log(`⚠ ${result.errors.length} file non ingestiti`);
  for (const err of result.errors) {
    console.log(`  ✗ ${err.file}: ${err.error}`);
  }
  return true;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = printEnvCheck();
  if (!args.dryRun && (env.openai === "MISS" || env.pinecone === "MISS")) {
    console.error("Ingest interrotto: servono OPENAI_API_KEY e PINECONE_API_KEY + PINECONE_INDEX.");
    process.exit(1);
  }

  const {
    INGEST_PILLARS,
    SIMILARITY_THRESHOLD_ECONOMIC,
    SIMILARITY_THRESHOLD_LEGAL,
    SIMILARITY_THRESHOLD_PROTOCOL,
    ingestSpecialtyFromDisk,
  } = await import("@/lib/services/ingestion-service");
  const { prisma } = await import("@/lib/prisma");

  console.log("----------------------------------------------------");
  console.log(
    args.dryRun
      ? "🧪 DRY-RUN SPECIALTY DOCS (elenco file, nessun parsing PDF / OpenAI / Pinecone)"
      : "📥 INGEST SPECIALTY DOCS → Pinecone + Prisma",
  );
  console.log("----------------------------------------------------");
  console.log(`Specialty : ${args.specialties.join(", ")}`);
  console.log(
    `Mode      : ${
      args.dryRun ? "DRY-RUN" : args.update ? "UPDATE (replace by source)" : "CREATE (skip existing)"
    }`,
  );
  console.log(
    `RAG soglie: LEGAL=${SIMILARITY_THRESHOLD_LEGAL} | ECONOMIC=${SIMILARITY_THRESHOLD_ECONOMIC} | CLINICAL=${SIMILARITY_THRESHOLD_PROTOCOL}`,
  );
  console.log(`Pilastri  : ${INGEST_PILLARS.map((pillar) => pillar.pillar).join(", ")}`);
  console.log("Cartelle  : legal/, economic/, clinical/ oppure clinic/, empathy/, più la radice di generale/ e empatia/ (pilastro EMPATHY)");
  console.log("----------------------------------------------------");

  let failed = false;
  try {
    for (const specialtySlug of args.specialties) {
      try {
        const result = await ingestSpecialtyFromDisk({
          specialty: specialtySlug,
          update: args.update,
          dryRun: args.dryRun,
          onProgress: (_progress, message) => {
            console.log(`  → ${specialtySlug}: ${message}`);
          },
        });
        if (printSpecialtyReport(specialtySlug, result, args.dryRun)) failed = true;
      } catch (error) {
        failed = true;
        const message = error instanceof Error ? error.message : String(error);
        console.error(`\n❌ ${specialtySlug}: ${message}`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log("----------------------------------------------------");
  if (failed) {
    console.log("⚠ Ingest completato con errori");
    process.exitCode = 1;
  } else {
    console.log(args.dryRun ? "🎉 DRY-RUN COMPLETATO" : "🎉 INGEST COMPLETATO");
  }
  console.log("----------------------------------------------------");
}

main().catch((error) => {
  console.error("\n❌ Ingest fallito:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
