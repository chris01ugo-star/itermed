/** Deterministic demo vitals / display names for immersive Prassi UI (not clinical truth). */

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export type DemoVitals = {
  bp: string;
  hr: number;
  spo2: number;
  temp: string;
  rr: number;
};

export function deriveDemoVitals(caseId: string, stress = 0): DemoVitals {
  const seed = hashSeed(caseId || "demo");
  // Behavioral stress may nudge HR/RR slightly; SpO₂ must NOT collapse from stress alone.
  // Prefer resolveMonitorVitals() for the live clinical monitor.
  const stressClamped = Math.max(0, Math.min(100, stress));
  const stressFactor = stressClamped / 100;

  const systolic = Math.round(110 + (seed % 25) + stressFactor * 8);
  const diastolic = Math.round(68 + (seed % 18) + stressFactor * 4);
  const hr = Math.round(62 + (seed % 28) + stressFactor * 10);
  const spo2 = Math.max(92, Math.round(97 - (seed % 3) - stressFactor * 1.5));
  const temp = (36.1 + ((seed % 12) / 10) + stressFactor * 0.15).toFixed(1);
  const rr = Math.round(14 + (seed % 7) + stressFactor * 3);

  return {
    bp: `${systolic}/${diastolic}`,
    hr,
    spo2,
    temp,
    rr,
  };
}

/** Italian male given names — pick only when patient sex is M. */
export const MALE_FIRST_NAMES = [
  "Marco",
  "Luca",
  "Andrea",
  "Paolo",
  "Davide",
  "Giovanni",
  "Alessandro",
  "Matteo",
] as const;

/** Italian female given names — pick only when patient sex is F. */
export const FEMALE_FIRST_NAMES = [
  "Giulia",
  "Sara",
  "Elena",
  "Chiara",
  "Francesca",
  "Lucia",
  "Laura",
  "Anna",
] as const;

const LAST_NAMES = [
  "Bianchi",
  "Rossi",
  "Conti",
  "Ricci",
  "Greco",
  "Romano",
  "Esposito",
  "Marino",
  "Costa",
  "Gallo",
] as const;

export type PatientSexHint = "M" | "F" | string | null | undefined;

/** Normalize demographics sex / sex labels to M | F | null. */
export function normalizePatientSex(sex?: PatientSexHint): "M" | "F" | null {
  if (sex == null) return null;
  const s = String(sex).trim().toUpperCase();
  if (
    s === "M" ||
    s === "MALE" ||
    s === "MASCHIO" ||
    s === "MASCHILE" ||
    s === "UOMO" ||
    s.startsWith("SESSO: M")
  ) {
    return "M";
  }
  if (
    s === "F" ||
    s === "FEMALE" ||
    s === "FEMMINA" ||
    s === "FEMMINILE" ||
    s === "DONNA" ||
    s.startsWith("SESSO: F")
  ) {
    return "F";
  }
  return null;
}

/**
 * Infer sex from title/description only when demographics sex is missing.
 * Never overrides an explicit patient.sex / patient.gender value.
 */
function inferSexFromTitle(title?: string | null): "M" | "F" | null {
  const titleLower = (title ?? "").toLowerCase();
  if (
    titleLower.includes("donna") ||
    titleLower.includes("paziente f") ||
    titleLower.includes(" gravid") ||
    titleLower.includes("femmina") ||
    titleLower.includes("femminile")
  ) {
    return "F";
  }
  if (
    titleLower.includes("uomo") ||
    titleLower.includes("paziente m") ||
    titleLower.includes("maschio") ||
    titleLower.includes("maschile")
  ) {
    return "M";
  }
  return null;
}

/**
 * Deterministic display name for UI cards / vitals strip.
 * First name is ALWAYS chosen from the gender-matching pool based on
 * `patient.gender` / `patient.sex` (falls back to title hints, then M).
 */
export function patientDisplayName(
  caseId: string,
  title?: string | null,
  sex?: PatientSexHint,
): string {
  const seed = hashSeed(caseId || "demo");
  const resolvedSex = normalizePatientSex(sex) ?? inferSexFromTitle(title) ?? "M";
  const firstPool = resolvedSex === "F" ? FEMALE_FIRST_NAMES : MALE_FIRST_NAMES;
  const first = firstPool[seed % firstPool.length];
  const last = LAST_NAMES[(seed >>> 8) % LAST_NAMES.length];
  return `${first} ${last}`;
}

export function estimateAgeFromTitle(title?: string | null, fallback = 58): number {
  if (!title) return fallback;
  const match = title.match(/(\d{1,3})\s*anni?/i);
  if (match) {
    const n = Number(match[1]);
    if (Number.isFinite(n) && n >= 1 && n <= 110) return n;
  }
  return fallback;
}
