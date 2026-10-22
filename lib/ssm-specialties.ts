/** Canonical SSM (Scuola di Specializzazione Medica) categories for sidebar navigation. */
export const SSM_SPECIALTY_CATEGORIES = [
  "Anestesia e Rianimazione",
  "Cardiologia",
  "Chirurgia Generale",
  "Dermatologia",
  "Ematologia",
  "Endocrinologia",
  "Gastroenterologia",
  "Geriatria",
  "Malattie Infettive",
  "Medicina di Laboratorio",
  "Medicina d'Emergenza-Urgenza",
  "Medicina Interna",
  "Neurologia",
  "Oncologia",
  "Ortopedia e Traumatologia",
  "Ostetricia e Ginecologia",
  "Pediatria",
  "Pneumologia",
  "Psichiatria",
  "Radiologia",
  "Reumatologia",
  "Urologia",
] as const;

export type SsmSpecialtyLink = {
  name: string;
  specialtyId?: string;
};

/** Merges SSM taxonomy with DB specialties (id when name matches). */
export function buildSsmSpecialtyLinks(
  dbSpecialties: { id: string; name: string }[],
): SsmSpecialtyLink[] {
  const byName = new Map(dbSpecialties.map((s) => [s.name.toLowerCase(), s.id]));
  const seen = new Set<string>();

  const links: SsmSpecialtyLink[] = SSM_SPECIALTY_CATEGORIES.map((name) => {
    seen.add(name.toLowerCase());
    return {
      name,
      specialtyId: byName.get(name.toLowerCase()),
    };
  });

  for (const specialty of dbSpecialties) {
    if (!seen.has(specialty.name.toLowerCase())) {
      links.push({ name: specialty.name, specialtyId: specialty.id });
    }
  }

  return links;
}

export function specialtyFilterHref(link: SsmSpecialtyLink): string {
  if (link.specialtyId) {
    return `/dashboard/prassi?specialtyId=${encodeURIComponent(link.specialtyId)}`;
  }
  return `/dashboard/prassi?specialty=${encodeURIComponent(link.name)}`;
}
