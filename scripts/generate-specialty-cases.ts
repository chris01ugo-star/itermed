/**
 * CLI wrapper around `lib/services/case-generation-service`.
 *
 * Usage:
 *   npx tsx scripts/generate-specialty-cases.ts --specialty=cardiologia --count=5
 *   npx tsx scripts/generate-specialty-cases.ts --specialty=gastroenterologia --frequency=HIGH
 *   npx tsx scripts/generate-specialty-cases.ts --specialty=pneumologia --only=PNEUMO-001 --skip-llm
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { generateCases, isKbSpecialty } from "@/lib/services/case-generation-service";
import { prisma } from "@/lib/prisma";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

function parseArgs(argv: string[]) {
  let specialty = "";
  let count: number | undefined;
  let frequencyCategory: "HIGH" | "MEDIUM" | "LOW" | undefined;
  let difficulty: "BASE" | "INTERMEDIATE" | "ADVANCED" | undefined;
  let setting: "GUARDIA_MEDICA" | "PRONTO_SOCCORSO" | "AMBULATORIO" | "REPARTO" | undefined;
  let onlyIds: string[] | undefined;
  let skipLlm = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--skip-llm") skipLlm = true;
    if (arg.startsWith("--specialty=")) specialty = arg.slice("--specialty=".length).trim();
    if (arg === "--specialty") {
      specialty = (argv[i + 1] ?? "").trim();
      i += 1;
    }
    if (arg.startsWith("--count=")) count = Number(arg.slice("--count=".length));
    if (arg.startsWith("--frequency=")) {
      frequencyCategory = arg.slice("--frequency=".length).trim().toUpperCase() as typeof frequencyCategory;
    }
    if (arg.startsWith("--difficulty=")) {
      difficulty = arg.slice("--difficulty=".length).trim().toUpperCase() as typeof difficulty;
    }
    if (arg.startsWith("--setting=")) {
      setting = arg.slice("--setting=".length).trim().toUpperCase() as typeof setting;
    }
    if (arg.startsWith("--only=")) {
      onlyIds = arg
        .slice("--only=".length)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }

  if (!isKbSpecialty(specialty.toLowerCase())) {
    console.error(
      "Usage: npx tsx scripts/generate-specialty-cases.ts --specialty=cardiologia|pneumologia|gastroenterologia [--count=N] [--frequency=HIGH|MEDIUM|LOW] [--difficulty=BASE|INTERMEDIATE|ADVANCED] [--setting=...] [--only=ID] [--skip-llm]",
    );
    process.exit(1);
  }

  return {
    specialty: specialty.toLowerCase() as "cardiologia" | "pneumologia" | "gastroenterologia",
    count,
    frequencyCategory,
    difficulty,
    setting,
    onlyIds,
    skipLlm,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log("----------------------------------------------------");
  console.log("🧬 GENERATE SPECIALTY CASES → Prisma KnowledgeBaseCase");
  console.log("----------------------------------------------------");
  console.log(JSON.stringify(args, null, 2));

  const result = await generateCases({
    ...args,
    onProgress: (_p, message) => console.log(`  → ${message}`),
  });

  console.log("----------------------------------------------------");
  console.log(`Upserted: ${result.upserted.join(", ") || "(none)"}`);
  console.log(`Failed  : ${result.failed.length}`);
  for (const fail of result.failed) {
    console.log(`  ✗ ${fail.id}: ${fail.error}`);
  }
  console.log(`RAG hits: ${result.ragHits}`);
  console.log("----------------------------------------------------");
  if (result.failed.length > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("\n❌ Generazione fallita:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
