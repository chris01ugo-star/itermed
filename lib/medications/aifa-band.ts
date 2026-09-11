export type AifaBand = "A" | "C" | "H";

export function isAifaBand(value: string | null | undefined): value is AifaBand {
  const v = value?.trim().toUpperCase();
  return v === "A" || v === "C" || v === "H";
}

/** DB value first; otherwise infer hospital (H) vs SSN (A) from pack shape. */
export function resolveAifaBand(input: {
  aifaBand?: string | null;
  category?: string | null;
  dosageForm?: string | null;
}): AifaBand {
  if (isAifaBand(input.aifaBand)) return input.aifaBand.trim().toUpperCase() as AifaBand;
  const form = (input.dosageForm ?? "").toLowerCase();
  const cat = (input.category ?? "").toLowerCase();
  if (cat === "urgenza" && /fiale|flaconcino|siringhe/.test(form)) return "H";
  return "A";
}

export function aifaBandLabel(band: AifaBand): string {
  if (band === "A") return "Fascia A";
  if (band === "C") return "Fascia C";
  return "Fascia H";
}

/** Parse AIFA class letter from seed/source notes like "AIFA Classe H AIC …". */
export function aifaBandFromSourceNote(source: string | null | undefined): AifaBand | null {
  const match = source?.match(/classe\s*([ACH])/i);
  if (!match?.[1]) return null;
  return match[1].toUpperCase() as AifaBand;
}

export const AIFA_BAND_BADGE_CLASS: Record<AifaBand, string> = {
  A: "border-emerald-800/35 bg-emerald-50 text-emerald-900",
  C: "border-amber-800/35 bg-amber-50 text-amber-950",
  H: "border-sky-800/40 bg-sky-50 text-sky-950",
};
