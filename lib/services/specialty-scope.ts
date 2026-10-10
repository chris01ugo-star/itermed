/**
 * Shared corpora live outside a single clinical specialty:
 * - `generale`: Gelli, consenso, codice deontologico, nomenclatore
 * - `empatia`: protocolli di comunicazione
 * Both are stored in Pinecone with metadata.specialty equal to the slug.
 */
export const UNIVERSAL_SPECIALTY = "generale";
export const EMPATHY_SPECIALTY = "empatia";

const SHARED_CORPUS = [UNIVERSAL_SPECIALTY, EMPATHY_SPECIALTY] as const;

export function isSharedCorpusSpecialty(slug: string | null | undefined): boolean {
  const value = (slug ?? "").trim().toLowerCase();
  return (SHARED_CORPUS as readonly string[]).includes(value);
}

/** `generale` and `empatia` are not rows in MedicalSpecialty. */
export function isUniversalSpecialty(slug: string | null | undefined): boolean {
  return isSharedCorpusSpecialty(slug);
}

function addSpecialtyLabel(values: Set<string>, raw: string): void {
  const trimmed = raw.trim();
  if (!trimmed) return;
  values.add(trimmed);
  const lower = trimmed.toLowerCase();
  values.add(lower);
  values.add(lower.charAt(0).toUpperCase() + lower.slice(1));
}

/**
 * Pinecone `{ specialty: { $in } }` values for a case.
 * Always includes `generale` and `empatia`. Optional secondary specialties
 * (comorbidities) are added beside the primary label.
 */
export function specialtyScopeValues(
  specialty: string,
  secondarySpecialties: string[] = [],
): string[] {
  const values = new Set<string>();
  addSpecialtyLabel(values, specialty);
  for (const extra of secondarySpecialties) addSpecialtyLabel(values, extra);
  for (const shared of SHARED_CORPUS) addSpecialtyLabel(values, shared);
  return [...values];
}

export function pineconeSpecialtyInFilter(
  specialty: string,
  secondarySpecialties: string[] = [],
): { specialty: { $in: string[] } } {
  return { specialty: { $in: specialtyScopeValues(specialty, secondarySpecialties) } };
}

/** Reads `secondarySpecialties` or `secondary_specialties` from a case payload. */
export function readSecondarySpecialties(source: unknown): string[] {
  if (!source || typeof source !== "object") return [];
  const record = source as Record<string, unknown>;
  const raw = record.secondarySpecialties ?? record.secondary_specialties;
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const values: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    values.push(trimmed);
  }
  return values;
}
