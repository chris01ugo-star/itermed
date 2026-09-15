/**
 * Audit (and optionally fix) duplicate ClinicalCase titles.
 *
 * Groups operational cases by normalized title (trim + collapsed whitespace +
 * case-insensitive) so the student dashboard never shows colliding names.
 *
 * Usage:
 *   npx tsx scripts/audit-duplicate-cases.ts
 *   npx tsx scripts/audit-duplicate-cases.ts --fix
 *
 * `--fix` keeps the oldest row in each group and rewrites the others with a
 * unique suffix: specialty when available, otherwise a numeric `#n` tag.
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

export type DuplicateCaseRow = {
  id: string;
  title: string;
  specialty: string | null;
  medicalSpecialtyName: string | null;
  createdAt: Date;
  isActive: boolean;
};

export type DuplicateTitleGroup = {
  /** Normalized grouping key (lowercase, trimmed, collapsed whitespace). */
  key: string;
  /** Exact titles present in the group (may differ only by case/spacing). */
  exactTitles: string[];
  cases: DuplicateCaseRow[];
};

function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

function specialtyLabel(row: DuplicateCaseRow): string | null {
  const fromRelation = row.medicalSpecialtyName?.trim();
  if (fromRelation) return fromRelation;
  const legacy = row.specialty?.trim();
  return legacy || null;
}

export function groupDuplicateTitles(rows: DuplicateCaseRow[]): DuplicateTitleGroup[] {
  const buckets = new Map<string, DuplicateCaseRow[]>();
  for (const row of rows) {
    const key = normalizeTitle(row.title);
    if (!key) {
      const emptyKey = "<empty>";
      const list = buckets.get(emptyKey) ?? [];
      list.push(row);
      buckets.set(emptyKey, list);
      continue;
    }
    const list = buckets.get(key) ?? [];
    list.push(row);
    buckets.set(key, list);
  }

  const groups: DuplicateTitleGroup[] = [];
  for (const [key, cases] of buckets) {
    if (cases.length < 2) continue;
    cases.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    groups.push({
      key,
      exactTitles: [...new Set(cases.map((c) => c.title))],
      cases,
    });
  }

  groups.sort((a, b) => b.cases.length - a.cases.length || a.key.localeCompare(b.key));
  return groups;
}

function isTaken(title: string, occupied: Set<string>): boolean {
  return occupied.has(normalizeTitle(title));
}

function claim(title: string, occupied: Set<string>): void {
  occupied.add(normalizeTitle(title));
}

/**
 * Build a unique display title for a duplicate row.
 * Prefers `Original (Specialty)`, then numbered variants, then a short id tag.
 */
export function allocateUniqueTitle(
  originalTitle: string,
  specialty: string | null,
  occupied: Set<string>,
  caseId: string,
): string {
  const base = originalTitle.trim().replace(/\s+/g, " ") || "Caso clinico";
  const candidates: string[] = [];

  if (specialty) {
    candidates.push(`${base} (${specialty})`);
  }

  for (let n = 2; n <= 99; n += 1) {
    candidates.push(specialty ? `${base} (${specialty} #${n})` : `${base} (#${n})`);
  }

  candidates.push(`${base} (${caseId.slice(0, 8)})`);

  for (const candidate of candidates) {
    if (!isTaken(candidate, occupied)) {
      claim(candidate, occupied);
      return candidate;
    }
  }

  const fallback = `${base} (${caseId})`;
  claim(fallback, occupied);
  return fallback;
}

export function planDuplicateTitleFixes(
  groups: DuplicateTitleGroup[],
  allRows: DuplicateCaseRow[],
): Array<{ id: string; from: string; to: string; keep: false }> {
  const occupied = new Set(allRows.map((row) => normalizeTitle(row.title)).filter(Boolean));
  const updates: Array<{ id: string; from: string; to: string; keep: false }> = [];

  for (const group of groups) {
    const [canonical, ...duplicates] = group.cases;
    if (!canonical) continue;
    // Canonical keeps its current title; reserve it so later groups cannot collide.
    claim(canonical.title, occupied);

    for (const row of duplicates) {
      const next = allocateUniqueTitle(row.title, specialtyLabel(row), occupied, row.id);
      if (next !== row.title) {
        updates.push({ id: row.id, from: row.title, to: next, keep: false });
      }
    }
  }

  return updates;
}

function printAudit(groups: DuplicateTitleGroup[]): void {
  console.log("=== Titoli duplicati (ClinicalCase) ===\n");

  if (groups.length === 0) {
    console.log("Nessun titolo duplicato trovato.");
    return;
  }

  let involved = 0;
  for (const group of groups) {
    involved += group.cases.length;
    const titleList = group.exactTitles.map((t) => JSON.stringify(t)).join(", ");
    console.log(`Titolo: ${titleList}`);
    console.log(`  gruppi_norm="${group.key}"  occorrenze=${group.cases.length}`);
    for (const [index, row] of group.cases.entries()) {
      const spec = specialtyLabel(row) ?? "Specialità N/D";
      const flag = index === 0 ? "  [KEEP]" : "";
      const active = row.isActive ? "active" : "inactive";
      console.log(
        `  - ${row.id}  specialty=${spec}  createdAt=${row.createdAt.toISOString()}  ${active}${flag}`,
      );
    }
    console.log("");
  }

  console.log(
    `Trovati ${groups.length} gruppi duplicati, ${involved} casi coinvolti.`,
  );
}

async function loadCases(prisma: PrismaClient): Promise<DuplicateCaseRow[]> {
  const rows = await prisma.clinicalCase.findMany({
    select: {
      id: true,
      title: true,
      specialty: true,
      createdAt: true,
      isActive: true,
      medicalSpecialty: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    specialty: row.specialty,
    medicalSpecialtyName: row.medicalSpecialty?.name ?? null,
    createdAt: row.createdAt,
    isActive: row.isActive,
  }));
}

async function applyFixes(
  prisma: PrismaClient,
  updates: Array<{ id: string; from: string; to: string }>,
): Promise<void> {
  if (updates.length === 0) {
    console.log("\nNessun aggiornamento da applicare.");
    return;
  }

  console.log("\n=== FIX titoli duplicati ===\n");
  await prisma.$transaction(
    updates.map((u) =>
      prisma.clinicalCase.update({
        where: { id: u.id },
        data: { title: u.to },
      }),
    ),
  );

  for (const u of updates) {
    console.log(`${u.id}: ${JSON.stringify(u.from)} → ${JSON.stringify(u.to)}`);
  }
  console.log(`\nAggiornati ${updates.length} titolo/i.`);
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is not set. Configure .env.local before running.");
  }

  const applyFix = process.argv.includes("--fix");
  const prisma = new PrismaClient();

  try {
    const rows = await loadCases(prisma);
    console.log(`ClinicalCase in database: ${rows.length}\n`);

    const groups = groupDuplicateTitles(rows);
    printAudit(groups);

    if (!applyFix) {
      if (groups.length > 0) {
        console.log("\nEsegui con --fix per normalizzare i titoli duplicati.");
      }
      return;
    }

    const updates = planDuplicateTitleFixes(groups, rows);
    await applyFixes(prisma, updates);

    const after = groupDuplicateTitles(await loadCases(prisma));
    if (after.length > 0) {
      console.log("\nATTENZIONE: restano ancora duplicati dopo il fix:");
      printAudit(after);
      process.exitCode = 1;
    } else {
      console.log("\nVerifica post-fix: nessun titolo duplicato.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
