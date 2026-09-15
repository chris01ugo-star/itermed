/**
 * Elenca tutti i documenti RAG salvati in GuidelineDocument.
 *
 * Usage:
 *   npx tsx scripts/list-guidelines.ts
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const prisma = new PrismaClient();

function formatTags(tags: string[]): string {
  if (tags.length === 0) return "(nessun tag)";
  return tags.join(", ");
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is not set. Configure .env.local before running.");
  }

  const docs = await prisma.guidelineDocument.findMany({
    orderBy: [{ medicalSpecialty: { name: "asc" } }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      sourceName: true,
      tags: true,
      isActive: true,
      medicalSpecialty: {
        select: { name: true },
      },
    },
  });

  console.log(`\nGuidelineDocument — ${docs.length} documento/i nel database\n`);

  if (docs.length === 0) {
    console.log("(nessun documento trovato)\n");
    return;
  }

  for (const [index, doc] of docs.entries()) {
    const displayTitle = doc.title?.trim() || doc.sourceName?.trim() || "(senza titolo)";
    const specialty = doc.medicalSpecialty?.name ?? "(trasversale / non collegata)";
    const n = String(index + 1).padStart(3, " ");

    console.log(`${n}. ${displayTitle}${doc.isActive ? "" : "  [inattivo]"}`);
    console.log(`     id:          ${doc.id}`);
    if (doc.sourceName && doc.sourceName !== doc.title) {
      console.log(`     file:        ${doc.sourceName}`);
    }
    console.log(`     specialty:   ${specialty}`);
    console.log(`     tags:        ${formatTags(doc.tags)}`);
    console.log("");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
