/**
 * Prassi / simulator palette.
 * Soft pastels spaced around the hue wheel so many specialties stay distinct.
 */
export type PrassiPastel = { fill: string; border: string; accent: string };

/**
 * Ordered roughly by hue. Keep saturation/lightness similar so folders feel
 * like one family while remaining distinguishable.
 */
export const PRASSI_PASTELS: PrassiPastel[] = [
  { fill: "#EEF1F5", border: "#D5DBE4", accent: "#345884" }, // slate-navy
  { fill: "#E8FAF2", border: "#B7EBD0", accent: "#10B981" }, // mint
  { fill: "#FFF8E1", border: "#FFE08A", accent: "#E0A82E" }, // soft gold
  { fill: "#FFEBEF", border: "#FFC0CD", accent: "#E11D48" }, // rose
  { fill: "#F3EDFF", border: "#D8C8FF", accent: "#7C3AED" }, // violet
  { fill: "#F0F7F8", border: "#D0E4E8", accent: "#0F766E" }, // teal
  { fill: "#F6F3EE", border: "#E5DED3", accent: "#78716C" }, // sand
  // Extended set for many specialties (still pastel, not neon)
  { fill: "#EAF3FF", border: "#C5DBF5", accent: "#2563EB" }, // soft blue
  { fill: "#FFF0E8", border: "#FFD0B5", accent: "#C2410C" }, // apricot
  { fill: "#ECFDF5", border: "#A7F3D0", accent: "#059669" }, // emerald mist
  { fill: "#FDF2F8", border: "#FBCFE8", accent: "#DB2777" }, // pink
  { fill: "#F5F3FF", border: "#DDD6FE", accent: "#6D28D9" }, // soft indigo
  { fill: "#F0FDFA", border: "#99F6E4", accent: "#0F766E" }, // aqua
  { fill: "#FEF3C7", border: "#FDE68A", accent: "#B45309" }, // amber wash
  { fill: "#EEF2FF", border: "#C7D2FE", accent: "#4338CA" }, // periwinkle
  { fill: "#F7FEE7", border: "#D9F99D", accent: "#4D7C0F" }, // lime mist
  { fill: "#FFF1F2", border: "#FECDD3", accent: "#BE123C" }, // soft crimson
  { fill: "#ECFEFF", border: "#A5F3FC", accent: "#0E7490" }, // cyan mist
];

export const PRASSI_TONE = {
  blue: PRASSI_PASTELS[0], // slate-navy — kept key for compatibility
  mint: PRASSI_PASTELS[1],
  peach: PRASSI_PASTELS[2],
  blush: PRASSI_PASTELS[3],
  lavender: PRASSI_PASTELS[4],
  sky: PRASSI_PASTELS[5],
  sand: PRASSI_PASTELS[6],
} as const;

export function prassiPastel(index: number): PrassiPastel {
  return PRASSI_PASTELS[Math.abs(index) % PRASSI_PASTELS.length];
}

function hashLabel(label: string): number {
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Coprime step so consecutive specialties land far apart on the hue wheel
 * instead of neighbouring pastels looking alike.
 */
function coprimeStep(length: number): number {
  const candidates = [7, 5, 11, 13, 17, 3];
  for (const step of candidates) {
    if (step < length && gcd(step, length) === 1) return step;
  }
  return 1;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

/**
 * Stable specialty → pastel map. Sorted labels + coprime stride minimize
 * near-duplicates when many specialties share the page.
 */
export function assignSpecialtyPastels(labels: string[]): Map<string, PrassiPastel> {
  const unique = Array.from(
    new Set(labels.map((l) => l.trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, "it"));

  const n = PRASSI_PASTELS.length;
  const step = coprimeStep(n);
  const seed = unique.length ? hashLabel(unique.join("|")) % n : 0;
  const map = new Map<string, PrassiPastel>();

  unique.forEach((label, i) => {
    map.set(label, PRASSI_PASTELS[(seed + i * step) % n]);
  });

  return map;
}

/** Hash fallback when a full specialty list is not available. */
export function specialtyPastel(label: string): PrassiPastel {
  return PRASSI_PASTELS[hashLabel(label) % PRASSI_PASTELS.length];
}

/**
 * Slightly lighter sibling for case folders inside a specialty folder —
 * same family, still readable as nested.
 */
export function nestPastel(parent: PrassiPastel): PrassiPastel {
  return {
    fill: mixTowardWhite(parent.fill, 0.28),
    border: mixTowardWhite(parent.border, 0.12),
    accent: parent.accent,
  };
}

function mixTowardWhite(hex: string, amount: number): string {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return hex;
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  if (![r, g, b].every(Number.isFinite)) return hex;
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `#${[mix(r), mix(g), mix(b)]
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")}`;
}
