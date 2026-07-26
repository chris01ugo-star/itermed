/**
 * Prassi / simulator palette.
 * Navy slate replaces the previous baby-blue ("azzurrino").
 */
export type PrassiPastel = { fill: string; border: string; accent: string };

export const PRASSI_PASTELS: PrassiPastel[] = [
  { fill: "#EEF1F5", border: "#D5DBE4", accent: "#345884" }, // slate-navy (was bright blue)
  { fill: "#E8FAF2", border: "#B7EBD0", accent: "#10B981" }, // mint
  { fill: "#FFF8E1", border: "#FFE08A", accent: "#E0A82E" }, // soft gold
  { fill: "#FFEBEF", border: "#FFC0CD", accent: "#E11D48" }, // rose
  { fill: "#F3EDFF", border: "#D8C8FF", accent: "#7C3AED" }, // violet
  { fill: "#F0F7F8", border: "#D0E4E8", accent: "#0F766E" }, // teal (was cyan/sky)
  { fill: "#F6F3EE", border: "#E5DED3", accent: "#78716C" }, // sand
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
