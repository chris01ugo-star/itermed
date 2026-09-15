import type { Prisma } from "@prisma/client";
import { resolveAifaBand, type AifaBand } from "@/lib/medications/aifa-band";
import { getPrismaClient } from "@/lib/prisma";

export type MedicationListItem = {
  id: string;
  commercialName: string;
  activeIngredient: string;
  dosageForm: string;
  price: number;
  category: string;
  aifaBand: AifaBand;
};

type MedicationRow = {
  id: string;
  commercialName: string;
  activeIngredient: string;
  dosageForm: string;
  price: number;
  category: string;
  aifaBand?: string | null;
};

type MedicationDelegate = {
  findMany: (args: Record<string, unknown>) => Promise<MedicationRow[]>;
  findUnique: (args: Record<string, unknown>) => Promise<MedicationRow | null>;
};

/**
 * Prisma maps model `Medication` → client accessor `prisma.medication` (camelCase).
 * Next.js can keep a webpack-bundled PrismaClient from before `prisma generate`,
 * where `prisma.medication` is undefined.
 */
function medicationDelegate(): MedicationDelegate | null {
  const client = getPrismaClient() as unknown as {
    medication?: MedicationDelegate;
  };
  const delegate = client.medication;
  if (!delegate?.findMany || !delegate?.findUnique) return null;
  return delegate;
}

function toListItem(row: MedicationRow): MedicationListItem {
  return {
    id: row.id,
    commercialName: row.commercialName,
    activeIngredient: row.activeIngredient,
    dosageForm: row.dosageForm,
    price: Number(row.price),
    category: row.category,
    aifaBand: resolveAifaBand(row),
  };
}

function isUnknownAifaBandSelect(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /aifaBand|Unknown (?:arg|field)|column/i.test(msg);
}

const BASE_SELECT = {
  id: true,
  commercialName: true,
  activeIngredient: true,
  dosageForm: true,
  price: true,
  category: true,
} as const;

function mapRawRows(rows: unknown): MedicationRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter(
    (row): row is MedicationRow =>
      Boolean(row) &&
      typeof row === "object" &&
      typeof (row as MedicationRow).id === "string" &&
      typeof (row as MedicationRow).commercialName === "string",
  );
}

async function listMedicationsRaw(filters?: {
  q?: string;
  category?: string;
  take?: number;
}): Promise<MedicationRow[]> {
  const prisma = getPrismaClient();
  const take = Math.min(Math.max(filters?.take ?? 40, 1), 80);
  const q = filters?.q?.trim() ?? "";
  const category = filters?.category?.trim() ?? "";
  const pattern = q ? `%${q}%` : null;

  try {
    if (pattern && category) {
      return mapRawRows(
        await prisma.$queryRaw`
          SELECT id, "commercialName", "activeIngredient", "dosageForm", price, category, "aifaBand"
          FROM "Medication"
          WHERE category ILIKE ${category}
            AND (
              "commercialName" ILIKE ${pattern}
              OR "activeIngredient" ILIKE ${pattern}
              OR "dosageForm" ILIKE ${pattern}
              OR category ILIKE ${pattern}
            )
          ORDER BY category ASC, "commercialName" ASC
          LIMIT ${take}
        `,
      );
    }
    if (pattern) {
      return mapRawRows(
        await prisma.$queryRaw`
          SELECT id, "commercialName", "activeIngredient", "dosageForm", price, category, "aifaBand"
          FROM "Medication"
          WHERE "commercialName" ILIKE ${pattern}
             OR "activeIngredient" ILIKE ${pattern}
             OR "dosageForm" ILIKE ${pattern}
             OR category ILIKE ${pattern}
          ORDER BY category ASC, "commercialName" ASC
          LIMIT ${take}
        `,
      );
    }
    if (category) {
      return mapRawRows(
        await prisma.$queryRaw`
          SELECT id, "commercialName", "activeIngredient", "dosageForm", price, category, "aifaBand"
          FROM "Medication"
          WHERE category ILIKE ${category}
          ORDER BY category ASC, "commercialName" ASC
          LIMIT ${take}
        `,
      );
    }
    return mapRawRows(
      await prisma.$queryRaw`
        SELECT id, "commercialName", "activeIngredient", "dosageForm", price, category, "aifaBand"
        FROM "Medication"
        ORDER BY category ASC, "commercialName" ASC
        LIMIT ${take}
      `,
    );
  } catch (error) {
    if (!isUnknownAifaBandSelect(error)) throw error;
    return mapRawRows(
      await prisma.$queryRaw`
        SELECT id, "commercialName", "activeIngredient", "dosageForm", price, category
        FROM "Medication"
        ORDER BY category ASC, "commercialName" ASC
        LIMIT ${take}
      `,
    );
  }
}

async function getMedicationByIdRaw(id: string): Promise<MedicationRow | null> {
  const prisma = getPrismaClient();
  try {
    const rows = mapRawRows(
      await prisma.$queryRaw`
        SELECT id, "commercialName", "activeIngredient", "dosageForm", price, category, "aifaBand"
        FROM "Medication"
        WHERE id = ${id}
        LIMIT 1
      `,
    );
    return rows[0] ?? null;
  } catch (error) {
    if (!isUnknownAifaBandSelect(error)) throw error;
    const rows = mapRawRows(
      await prisma.$queryRaw`
        SELECT id, "commercialName", "activeIngredient", "dosageForm", price, category
        FROM "Medication"
        WHERE id = ${id}
        LIMIT 1
      `,
    );
    return rows[0] ?? null;
  }
}

export async function listMedications(filters?: {
  q?: string;
  category?: string;
  take?: number;
}): Promise<MedicationListItem[]> {
  const delegate = medicationDelegate();
  if (!delegate) {
    return (await listMedicationsRaw(filters)).map(toListItem);
  }

  const where: Prisma.MedicationWhereInput = {};

  if (filters?.category?.trim()) {
    where.category = { equals: filters.category.trim(), mode: "insensitive" };
  }

  if (filters?.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { commercialName: { contains: q, mode: "insensitive" } },
      { activeIngredient: { contains: q, mode: "insensitive" } },
      { dosageForm: { contains: q, mode: "insensitive" } },
      { category: { contains: q, mode: "insensitive" } },
    ];
  }

  try {
    const rows = await delegate.findMany({
      where,
      select: { ...BASE_SELECT, aifaBand: true },
      orderBy: [{ category: "asc" }, { commercialName: "asc" }],
      take: filters?.take ?? 40,
    });
    return rows.map(toListItem);
  } catch (error) {
    if (!isUnknownAifaBandSelect(error)) throw error;
    try {
      const rows = await delegate.findMany({
        where,
        select: BASE_SELECT,
        orderBy: [{ category: "asc" }, { commercialName: "asc" }],
        take: filters?.take ?? 40,
      });
      return rows.map(toListItem);
    } catch {
      return (await listMedicationsRaw(filters)).map(toListItem);
    }
  }
}

export async function getMedicationById(id: string): Promise<MedicationListItem | null> {
  const delegate = medicationDelegate();
  if (!delegate) {
    const row = await getMedicationByIdRaw(id);
    return row ? toListItem(row) : null;
  }

  try {
    const row = await delegate.findUnique({
      where: { id },
      select: { ...BASE_SELECT, aifaBand: true },
    });
    return row ? toListItem(row) : null;
  } catch (error) {
    if (!isUnknownAifaBandSelect(error)) throw error;
    try {
      const row = await delegate.findUnique({
        where: { id },
        select: BASE_SELECT,
      });
      return row ? toListItem(row) : null;
    } catch {
      const row = await getMedicationByIdRaw(id);
      return row ? toListItem(row) : null;
    }
  }
}
