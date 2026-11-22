/**
 * Removes leftover placeholder guideline documents from PostgreSQL and Pinecone.
 * Matches title or sourceName containing "placeholder" (case-insensitive).
 * Does not touch any other GuidelineDocument row.
 *
 * Usage:
 *   npx tsx scripts/cleanup-rag-placeholders.ts --dry-run
 *   npx tsx scripts/cleanup-rag-placeholders.ts
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env") });
loadEnv({ path: resolve(process.cwd(), ".env.local"), override: true });

const DELETE_BATCH = 200;

function asVectorIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const { PINECONE_GUIDELINES_NAMESPACE } = await import("@/lib/services/ingestion-service");
  const { getPineconeIndex } = await import("@/lib/pinecone");
  const { prisma } = await import("@/lib/prisma");

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

  try {
    const docs = await prisma.guidelineDocument.findMany({
      where: {
        OR: [
          { title: { contains: "placeholder", mode: "insensitive" } },
          { sourceName: { contains: "placeholder", mode: "insensitive" } },
        ],
      },
      select: { id: true, title: true, sourceName: true, vectorIds: true, chunkCount: true },
      orderBy: { title: "asc" },
    });

    console.log("----------------------------------------------------");
    console.log(dryRun ? "🧪 DRY-RUN CLEANUP PLACEHOLDER RAG" : "🧹 CLEANUP PLACEHOLDER RAG");
    console.log("----------------------------------------------------");
    console.log(`Documenti placeholder: ${docs.length}`);

    if (docs.length === 0) {
      console.log("Nessun documento placeholder da rimuovere.");
      return;
    }

    for (const doc of docs) {
      const vectors = asVectorIds(doc.vectorIds);
      console.log(`- ${doc.title}`);
      console.log(
        `  source: ${doc.sourceName ?? "(nessuno)"}  vettori: ${vectors.length}  chunk: ${doc.chunkCount}`,
      );
    }

    if (dryRun) {
      console.log("Dry-run: nessuna cancellazione eseguita.");
      return;
    }

    const vectorIds = docs.flatMap((doc) => asVectorIds(doc.vectorIds));
    if (vectorIds.length > 0 && !getPineconeIndex()) {
      throw new Error("Pinecone non configurato: i vettori placeholder non possono essere rimossi.");
    }

    await deleteVectors(vectorIds);
    const removed = await prisma.guidelineDocument.deleteMany({
      where: { id: { in: docs.map((doc) => doc.id) } },
    });
    console.log("----------------------------------------------------");
    console.log(`Rimossi ${removed.count} documenti e ${vectorIds.length} vettori.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("\n❌ Cleanup fallito:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
