/**
 * Maps case demographics (`sex` / `gender`) onto Italian grammatical gender.
 * Accepts canonical F/M and common Italian/English labels from authored cases.
 */

export type PatientGrammaticalGender = "M" | "F";

export function resolvePatientGrammaticalGender(
  raw: string | null | undefined,
): PatientGrammaticalGender | null {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;

  if (
    s === "f" ||
    s === "w" ||
    s === "female" ||
    s === "woman" ||
    s === "donna" ||
    s.startsWith("femmin")
  ) {
    return "F";
  }

  if (
    s === "m" ||
    s === "male" ||
    s === "man" ||
    s === "uomo" ||
    s.startsWith("masch")
  ) {
    return "M";
  }

  return null;
}

export function italianAgreementPhrase(gender: PatientGrammaticalGender): string {
  return gender === "F"
    ? "femminile (es. sono andata, sono stanca, sono preoccupata)"
    : "maschile (es. sono andato, sono stanco, sono preoccupato)";
}
