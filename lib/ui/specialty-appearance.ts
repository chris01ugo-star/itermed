import { Bone, type LucideIcon } from "lucide-react";

export type SpecialtyAppearance = {
  icon: LucideIcon | null;
  badgeClass: string;
  accent: string;
};

const DEFAULT_APPEARANCE: SpecialtyAppearance = {
  icon: null,
  badgeClass: "border-[#345884]/15 bg-[#345884]/10 text-[#345884]",
  accent: "#345884",
};

/**
 * Aspetto di specialità per badge e cartelle.
 * Le specialità senza voce tengono il blu del tema, senza lanciare.
 */
const SPECIALTY_APPEARANCE: Record<string, SpecialtyAppearance> = {
  reumatologia: {
    icon: Bone,
    badgeClass: "border-[#E7D3B0] bg-[#FBF6EE] text-[#8A5A2B]",
    accent: "#8A5A2B",
  },
};

function specialtyKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function specialtyAppearance(label: string | null | undefined): SpecialtyAppearance {
  if (!label?.trim()) return DEFAULT_APPEARANCE;
  return SPECIALTY_APPEARANCE[specialtyKey(label)] ?? DEFAULT_APPEARANCE;
}
