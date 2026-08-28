/** Client-safe radar dimension labels (no Prisma / env imports). */
export const OVERVIEW_RADAR_METRICS = [
  { metric: "Accuratezza Clinica", key: "clinicalAccuracy" as const },
  { metric: "Tutela Legale", key: "legalComplianceGelliBianco" as const },
  { metric: "Appropriatezza", key: "prescribingAppropriateness" as const },
  { metric: "Sostenibilità", key: "economicSustainability" as const },
  { metric: "Comunicazione", key: "empathy" as const },
];

export type OverviewRadarMetricKey = (typeof OVERVIEW_RADAR_METRICS)[number]["key"];

export const FOCUS_LABELS: Record<OverviewRadarMetricKey, string> = {
  clinicalAccuracy: "Accuratezza Clinica",
  legalComplianceGelliBianco: "Tutela Medico-Legale",
  prescribingAppropriateness: "Appropriatezza Prescrittiva",
  economicSustainability: "Sostenibilità Economica",
  empathy: "Comunicazione e Relazione Clinica",
};
