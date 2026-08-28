/**
 * Migrate authored knowledge-base JSON cases into PostgreSQL (`KnowledgeBaseCase`).
 *
 * Reads recursively from:
 *   knowledge_base/{cardiologia,pneumologia,gastroenterologia}/cases/*.json
 *
 * Usage:
 *   npx tsx scripts/migrate-cases-to-db.ts
 */
import { config as loadEnv } from "dotenv";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { knowledgeBaseCaseSchema } from "@/lib/cases/knowledge-base-case-schema";
import { clearCasesCache } from "@/lib/data/cases/registry-store";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const KB_ROOT = resolve(process.cwd(), "knowledge_base");
const SPECIALTIES = ["cardiologia", "pneumologia", "gastroenterologia"] as const;
const CASE_FILE_RE = /^(CARDIO|PNEUMO|GASTRO)-\d{3}\.json$/i;

async function collectCaseFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectCaseFiles(full)));
      continue;
    }
    if (entry.isFile() && CASE_FILE_RE.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const files: string[] = [];
  for (const specialty of SPECIALTIES) {
    files.push(...(await collectCaseFiles(join(KB_ROOT, specialty))));
  }
  files.sort();

  console.log(`[migrate-cases] found ${files.length} JSON case files`);

  let upserted = 0;
  const failures: Array<{ file: string; error: string }> = [];

  try {
    for (const file of files) {
      let raw: unknown;
      try {
        raw = JSON.parse(await readFile(file, "utf8")) as unknown;
      } catch (err) {
        failures.push({
          file,
          error: `JSON parse failed: ${err instanceof Error ? err.message : String(err)}`,
        });
        continue;
      }

      const parsed = knowledgeBaseCaseSchema.safeParse(raw);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        const path = first?.path?.join(".") || "root";
        failures.push({
          file,
          error: `Zod ${path}: ${first?.message ?? "schema error"}`,
        });
        continue;
      }

      const kb = parsed.data;
      const patientProfile = kb.patientProfile ?? {};
      const ragSources = kb.escCitations;

      await prisma.knowledgeBaseCase.upsert({
        where: { id: kb.id },
        create: {
          id: kb.id,
          specialty: kb.specialty,
          version: 1,
          title: kb.title,
          patientProfile: patientProfile as Prisma.InputJsonValue,
          caseData: kb as Prisma.InputJsonValue,
          ragSources: ragSources as Prisma.InputJsonValue,
        },
        update: {
          specialty: kb.specialty,
          title: kb.title,
          patientProfile: patientProfile as Prisma.InputJsonValue,
          caseData: kb as Prisma.InputJsonValue,
          ragSources: ragSources as Prisma.InputJsonValue,
        },
      });
      upserted += 1;
      console.log(`[migrate-cases] upserted ${kb.id} (${kb.specialty})`);
    }
  } finally {
    await prisma.$disconnect();
  }

  if (failures.length > 0) {
    console.error(`[migrate-cases] ${failures.length} file(s) failed validation:`);
    for (const f of failures) {
      console.error(`  - ${f.file}: ${f.error}`);
    }
    process.exitCode = 1;
  }

  console.log(`[migrate-cases] done: ${upserted} upserted, ${failures.length} failed`);
  if (upserted !== 90 && failures.length === 0) {
    console.warn(`[migrate-cases] expected 90 cases, upserted ${upserted}`);
  }
  clearCasesCache();
}

main().catch((err) => {
  console.error("[migrate-cases] fatal", err);
  process.exit(1);
});
