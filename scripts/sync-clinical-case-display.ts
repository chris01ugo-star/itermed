/**
 * Copy presentation title/description from KnowledgeBaseCase + authored
 * registry onto matching `ClinicalCase` rows (Prassi library reads this table).
 *
 * Usage:
 *   npx tsx scripts/sync-clinical-case-display.ts
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  AUTHORED_CASE_REGISTRY,
  knowledgeBaseIdCandidates,
} from "@/lib/data/cases/registry-store";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

type DisplaySource = { title: string; description?: string };

function remember(
  map: Map<string, DisplaySource>,
  rawId: string,
  source: DisplaySource,
  overwrite: boolean,
) {
  for (const key of knowledgeBaseIdCandidates(rawId)) {
    if (overwrite || !map.has(key)) map.set(key, source);
  }
}

export async function syncClinicalCaseDisplay(prisma: PrismaClient): Promise<number> {
  const sources = new Map<string, DisplaySource>();

  for (const authored of AUTHORED_CASE_REGISTRY) {
    const source = { title: authored.title, description: authored.description };
    remember(sources, authored.id, source, true);
    remember(sources, authored.code, source, true);
  }

  const kbRows = await prisma.knowledgeBaseCase.findMany({
    select: { id: true, title: true, caseData: true },
  });
  for (const row of kbRows) {
    const data = row.caseData as { description?: unknown } | null;
    const description =
      typeof data?.description === "string" && data.description.trim()
        ? data.description.trim()
        : undefined;
    remember(sources, row.id, { title: row.title, description }, false);
  }

  const cases = await prisma.clinicalCase.findMany({
    select: { id: true, title: true, description: true },
  });

  let updated = 0;
  for (const row of cases) {
    let source: DisplaySource | undefined;
    for (const key of knowledgeBaseIdCandidates(row.id)) {
      source = sources.get(key);
      if (source) break;
    }
    if (!source) continue;

    const nextDescription = source.description?.trim() || row.description;
    if (row.title === source.title && row.description === nextDescription) continue;

    await prisma.clinicalCase.update({
      where: { id: row.id },
      data: {
        title: source.title,
        description: nextDescription,
      },
    });
    updated += 1;
    console.log(`[sync-clinical] ${row.id}\n  ← ${row.title}\n  → ${source.title}`);
  }

  return updated;
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const updated = await syncClinicalCaseDisplay(prisma);
    console.log(`[sync-clinical] done: ${updated} ClinicalCase row(s) updated`);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.endsWith("sync-clinical-case-display.ts")) {
  main().catch((err) => {
    console.error("[sync-clinical] fatal", err);
    process.exit(1);
  });
}
