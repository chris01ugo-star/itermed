/**
 * CLI wrapper around `lib/services/ingestion-service`.
 *
 * Expected layout:
 *   knowledge_base/<specialty>/legal|economic|clinical/*.{pdf,md,txt,json,csv}
 *
 * Usage:
 *   npx tsx scripts/ingest-specialty-docs.ts --specialty=cardiologia
 *   npx tsx scripts/ingest-specialty-docs.ts --specialty=cardiologia --update
 *   npx tsx scripts/ingest-specialty-docs.ts --specialty=cardiologia --dry-run
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import {
  INGEST_PILLARS,
  SIMILARITY_THRESHOLD_ECONOMIC,
  SIMILARITY_THRESHOLD_LEGAL,
  SIMILARITY_THRESHOLD_PROTOCOL,
  ingestSpecialtyFromDisk,
  type IngestPillar,
} from "@/lib/services/ingestion-service";
import { prisma } from "@/lib/prisma";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

type CliArgs = {
  specialty: string;
  update: boolean;
  dryRun: boolean;
};

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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const specialtySlug = args.specialty.toLowerCase();

  console.log("----------------------------------------------------");
  console.log(
    args.dryRun
      ? "🧪 DRY-RUN SPECIALTY DOCS (IO + parsing, no Pinecone/Prisma)"
      : "📥 INGEST SPECIALTY DOCS → Pinecone + Prisma",
  );
  console.log("----------------------------------------------------");
  console.log(`Specialty : ${specialtySlug}`);
  console.log(
    `Mode      : ${
      args.dryRun ? "DRY-RUN" : args.update ? "UPDATE (replace by source)" : "CREATE (skip existing)"
    }`,
  );
  console.log(
    `RAG soglie: LEGAL=${SIMILARITY_THRESHOLD_LEGAL} | ECONOMIC=${SIMILARITY_THRESHOLD_ECONOMIC} | CLINICAL=${SIMILARITY_THRESHOLD_PROTOCOL}`,
  );
  console.log(`Pilastri  : ${INGEST_PILLARS.map((p) => p.pillar).join(", ")}`);
  console.log("----------------------------------------------------");

  const result = await ingestSpecialtyFromDisk({
    specialty: specialtySlug,
    update: args.update,
    dryRun: args.dryRun,
    onProgress: (_progress, message) => {
      console.log(`  → ${message}`);
    },
  });

  console.log("----------------------------------------------------");
  console.log(args.dryRun ? "📊 REPORT DRY-RUN" : "📊 REPORT INGESTIONE");
  console.log("----------------------------------------------------");
  for (const pillar of ["LEGAL", "ECONOMIC", "CLINICAL"] as IngestPillar[]) {
    const s = result.stats[pillar];
    console.log(
      `${pillar.padEnd(9)} file=${s.files}  chunk=${s.chunks}  skipped=${s.skipped}  updated=${s.updated}`,
    );
  }
  console.log("----------------------------------------------------");
  console.log(`Documenti: ${result.documents}  chunk=${result.chunks}  skipped=${result.skipped}`);
  if (result.errors.length > 0) {
    console.log(`⚠ ${result.errors.length} file non ingestiti`);
    for (const err of result.errors) {
      console.log(`  ✗ ${err.file}: ${err.error}`);
    }
    process.exitCode = 1;
  } else {
    console.log(args.dryRun ? "🎉 DRY-RUN COMPLETATO" : "🎉 INGEST COMPLETATO");
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
