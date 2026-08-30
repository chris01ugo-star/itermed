import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type GuidelineListItem = {
  id: string;
  title: string;
  tags: string[];
  sourceType: string;
  sourceName: string | null;
  chunkCount: number;
  isActive: boolean;
  createdAt: Date;
};

export type GuidelineDetailItem = GuidelineListItem & {
  text: string;
};

export type GuidelineListItemWithExcerpt = GuidelineListItem & {
  /** First ~900 chars of body — enough for lead + expand preview without shipping full PDF text. */
  excerpt: string;
};

const guidelineListSelect = {
  id: true,
  title: true,
  tags: true,
  sourceType: true,
  sourceName: true,
  chunkCount: true,
  isActive: true,
  createdAt: true,
} as const;

const guidelineDetailSelect = {
  ...guidelineListSelect,
  text: true,
} as const;

export async function fetchGuidelineDocuments(options?: {
  activeOnly?: boolean;
  id?: string;
  /** Include full document text (dashboard preview). Omit for lightweight API list. */
  includeText?: boolean;
}): Promise<Array<GuidelineListItem | GuidelineDetailItem>> {
  const includeText = options?.includeText ?? false;

  return prisma.guidelineDocument.findMany({
    where: {
      ...(options?.activeOnly ? { isActive: true } : {}),
      ...(options?.id ? { id: options.id } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: includeText ? guidelineDetailSelect : guidelineListSelect,
  });
}

/**
 * Lightweight archive list: metadata + LEFT(text, 900) so the page does not
 * hydrate megabytes of PDF extracts into the client bundle.
 */
export async function fetchGuidelineDocumentsWithExcerpt(options?: {
  activeOnly?: boolean;
}): Promise<GuidelineListItemWithExcerpt[]> {
  const rows = await prisma.$queryRaw<GuidelineListItemWithExcerpt[]>(Prisma.sql`
    SELECT
      id,
      title,
      tags,
      "sourceType" AS "sourceType",
      "sourceName" AS "sourceName",
      "chunkCount" AS "chunkCount",
      "isActive" AS "isActive",
      "createdAt" AS "createdAt",
      LEFT(text, 900) AS excerpt
    FROM "GuidelineDocument"
    ${options?.activeOnly ? Prisma.sql`WHERE "isActive" = true` : Prisma.empty}
    ORDER BY "createdAt" DESC
  `);

  return rows.map((row) => ({
    ...row,
    tags: Array.isArray(row.tags) ? row.tags : [],
    excerpt: typeof row.excerpt === "string" ? row.excerpt : "",
  }));
}

export async function fetchGuidelineDocumentById(id: string): Promise<GuidelineDetailItem | null> {
  return prisma.guidelineDocument.findUnique({
    where: { id },
    select: guidelineDetailSelect,
  });
}
