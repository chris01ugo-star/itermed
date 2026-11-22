import type { Prisma } from "@prisma/client";

/**
 * Row lock for a live CaseSession. Must run inside `prisma.$transaction`
 * before reading JSON columns that concurrent writers merge.
 */
export async function lockCaseSessionForUpdate(
  tx: Prisma.TransactionClient,
  sessionId: string,
): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "CaseSession" WHERE id = ${sessionId} FOR UPDATE
  `;
  return rows.length > 0;
}
