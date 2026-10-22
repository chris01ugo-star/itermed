/** True for the laboratory module slug or its Italian label. Other specialties stay false. */
export function isLaboratorySpecialty(specialty: string | null | undefined): boolean {
  const value = specialty?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
  return (
    value === "laboratorio" ||
    value === "medicina_laboratorio" ||
    value === "medicina di laboratorio"
  );
}
