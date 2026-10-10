/**
 * Migrate authored knowledge-base JSON cases into PostgreSQL (`KnowledgeBaseCase`).
 *
 * Reads recursively from:
 *   knowledge_base/{cardiologia,pneumologia,gastroenterologia}/cases/*.json
 *   knowledge_base/medicina_interna/cases/*.json
 *   knowledge_base/tutorials/TUTORIAL-*.json
 *
 * Medicina Interna rows are also upserted into `ClinicalCase` and linked to the
 * existing MedicalSpecialty named "Medicina Interna".
 *
 * Usage:
 *   npx tsx scripts/migrate-cases-to-db.ts
 */
import { config as loadEnv } from "dotenv";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { knowledgeBaseCaseSchema } from "@/lib/cases/knowledge-base-case-schema";
import type { KnowledgeBaseCase } from "@/lib/cases/knowledge-base-case-schema";
import { clearCasesCache } from "@/lib/data/cases/registry-store";
import { readSecondarySpecialties } from "@/lib/services/specialty-scope";
import { syncClinicalCaseDisplay } from "./sync-clinical-case-display";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const KB_ROOT = resolve(process.cwd(), "knowledge_base");
const SPECIALTIES = ["cardiologia", "pneumologia", "gastroenterologia", "medicina_interna"] as const;
const CASE_FILE_RE = /^(CARDIO|PNEUMO|GASTRO|TUTORIAL|INTMED)-\d{3}\.json$/i;
const MEDICINA_INTERNA_SPECIALTY_NAME = "Medicina Interna";

function isCaseFile(full: string, name: string): boolean {
  if (CASE_FILE_RE.test(name)) return true;
  return /[/\\]medicina_interna[/\\]cases[/\\][^/\\]+\.json$/i.test(full);
}

async function collectCaseFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectCaseFiles(full)));
      continue;
    }
    if (entry.isFile() && isCaseFile(full, entry.name)) {
      files.push(full);
    }
  }
  return files;
}

async function upsertMedicinaInternaClinicalCase(
  prisma: PrismaClient,
  kb: KnowledgeBaseCase,
  createdById: string,
  medicalSpecialtyId: string,
): Promise<void> {
  const secondarySpecialties = readSecondarySpecialties(kb);
  await prisma.clinicalCase.upsert({
    where: { id: kb.id },
    create: {
      id: kb.id,
      title: kb.title,
      description: kb.description,
      specialty: kb.specialtyLabel,
      secondarySpecialties,
      difficulty: kb.difficulty,
      isGlobal: true,
      isActive: true,
      medicalSpecialtyId,
      estimatedDurationMinutes: kb.timeLimitMinutes,
      timeLimitMinutes: kb.timeLimitMinutes,
      patientDeteriorationThreshold: kb.patientDeteriorationThreshold,
      pastMedicalHistory: kb.pastMedicalHistory,
      correctSolution: kb.correctSolution,
      baselineExamFindings: kb.baselineExamFindings as Prisma.InputJsonValue,
      goldStandardPath: kb.goldStandardPath as Prisma.InputJsonValue,
      examLatencies: kb.examLatencies as Prisma.InputJsonValue,
      createdById,
      nodes: {
        create: [
          {
            order: 0,
            type: "HISTORY",
            content: { casePrompt: kb.patientPrompt ?? kb.presentation },
          },
        ],
      },
    },
    update: {
      title: kb.title,
      description: kb.description,
      specialty: kb.specialtyLabel,
      secondarySpecialties,
      difficulty: kb.difficulty,
      isGlobal: true,
      isActive: true,
      medicalSpecialtyId,
      estimatedDurationMinutes: kb.timeLimitMinutes,
      timeLimitMinutes: kb.timeLimitMinutes,
      patientDeteriorationThreshold: kb.patientDeteriorationThreshold,
      pastMedicalHistory: kb.pastMedicalHistory,
      correctSolution: kb.correctSolution,
      baselineExamFindings: kb.baselineExamFindings as Prisma.InputJsonValue,
      goldStandardPath: kb.goldStandardPath as Prisma.InputJsonValue,
      examLatencies: kb.examLatencies as Prisma.InputJsonValue,
    },
  });

  const nodeCount = await prisma.caseNode.count({ where: { caseId: kb.id } });
  if (nodeCount === 0) {
    await prisma.caseNode.create({
      data: {
        caseId: kb.id,
        order: 0,
        type: "HISTORY",
        content: { casePrompt: kb.patientPrompt ?? kb.presentation },
      },
    });
  }
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const files: string[] = [];
  for (const specialty of SPECIALTIES) {
    files.push(...(await collectCaseFiles(join(KB_ROOT, specialty))));
  }
  files.push(...(await collectCaseFiles(join(KB_ROOT, "tutorials"))));
  files.sort();

  console.log(`[migrate-cases] found ${files.length} JSON case files`);

  let upserted = 0;
  const failures: Array<{ file: string; error: string }> = [];

  const medicinaInterna = await prisma.medicalSpecialty.findFirst({
    where: { name: { equals: MEDICINA_INTERNA_SPECIALTY_NAME, mode: "insensitive" } },
    select: { id: true, name: true },
  });
  const author = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true },
  });
  if (!medicinaInterna) {
    console.error(
      `[migrate-cases] MedicalSpecialty "${MEDICINA_INTERNA_SPECIALTY_NAME}" assente: i casi INTMED non possono essere collegati.`,
    );
  } else if (!author) {
    console.error("[migrate-cases] Nessun utente ADMIN: i casi INTMED non possono essere creati in ClinicalCase.");
  } else {
    console.log(
      `[migrate-cases] Medicina Interna → ${medicinaInterna.id}; autore ${author.email ?? author.id}`,
    );
  }

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
      if (kb.specialty === "medicina_interna") {
        if (!medicinaInterna || !author) {
          failures.push({
            file,
            error: "ClinicalCase non scritto: manca la specialità Medicina Interna o un utente ADMIN.",
          });
          continue;
        }
        await upsertMedicinaInternaClinicalCase(prisma, kb, author.id, medicinaInterna.id);
      }

      upserted += 1;
      console.log(`[migrate-cases] upserted ${kb.id} (${kb.specialty})`);
    }

    const synced = await syncClinicalCaseDisplay(prisma);
    console.log(`[migrate-cases] synced ${synced} ClinicalCase display row(s)`);
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
  if (upserted < 90 && failures.length === 0) {
    console.warn(`[migrate-cases] expected at least 90 specialty cases, upserted ${upserted}`);
  }
  clearCasesCache();
}

main().catch((err) => {
  console.error("[migrate-cases] fatal", err);
  process.exit(1);
});
