import type { ClinicalAuditResult } from "@/lib/services/clinical-audit-service";
import type { EconomicAuditResult } from "@/lib/services/economic-audit-service";
import type { LegalAuditResult } from "@/lib/services/legal-audit-service";
import { clinicalAccuracyPercentFromAudit } from "@/lib/mappers/clinical-audit-mapper";
import { efficiencyPercentFromAudit } from "@/lib/mappers/economic-audit-mapper";
import { legalCompliancePercentFromAudit } from "@/lib/mappers/legal-audit-mapper";
import { isLabEvaluationCase, labPillarLabel } from "@/lib/reports/lab-evaluation-labels";

/** One pillar returned by the document-bound examiner. */
export type RagPillarScore = {
  score: number;
  feedback: string;
};

/**
 * Persisted on SessionReport.rawTrace.
 * When `authoritative` is true, radar and pillar cards read these scores
 * instead of the dedicated clinical / legal / economic audits.
 */
export type RagPillarTrace = {
  authoritative: boolean;
  isLab: boolean;
  retrievedQuery: string;
  sourceTitles: string[];
  clinica: RagPillarScore;
  economia: RagPillarScore;
  legale: RagPillarScore;
  empatia: RagPillarScore;
};

export type ResultsRadarPoint = {
  metric: string;
  key: string;
  score: number;
};

const RADAR_ROWS = [
  { key: "clinicalAccuracy", metric: "Accuratezza clinica" },
  { key: "legalComplianceGelliBianco", metric: "Tutela medico-legale" },
  { key: "prescribingAppropriateness", metric: "Appropriatezza esami" },
  { key: "economicSustainability", metric: "Sostenibilità economica" },
  { key: "empathy", metric: "Comunicazione" },
] as const;

export function readRagAuthoritative(trace: unknown): boolean {
  if (!trace || typeof trace !== "object") return false;
  const rag = (trace as { ragPillars?: { authoritative?: boolean } }).ragPillars;
  return rag?.authoritative === true;
}

/**
 * Radar axes expected by ResultsRadarClient / EliteResultsClient.
 * Lab cases rename Clinica → Rigore Pre-analitico (and the other lab titles).
 * Economia keeps its name; the prescribing axis shares the economia score.
 */
export function buildResultsRadar(input: {
  specialty?: string | null;
  caseId?: string | null;
  ragAuthoritative?: boolean;
  scores: {
    clinical: number;
    legal: number;
    exams: number;
    economy: number;
    empathy: number;
  };
  clinicalAudit?: ClinicalAuditResult | null;
  legalAudit?: LegalAuditResult | null;
  economicAudit?: EconomicAuditResult | null;
}): ResultsRadarPoint[] {
  const isLab = isLabEvaluationCase({
    specialty: input.specialty,
    caseId: input.caseId,
  });
  const rag = input.ragAuthoritative === true;
  const clinical = rag
    ? input.scores.clinical
    : (clinicalAccuracyPercentFromAudit(input.clinicalAudit) ?? input.scores.clinical);
  const legal = rag
    ? input.scores.legal
    : (legalCompliancePercentFromAudit(input.legalAudit) ?? input.scores.legal);
  const exams = rag
    ? input.scores.exams
    : (efficiencyPercentFromAudit(input.economicAudit) ?? input.scores.exams);
  const economy = rag
    ? input.scores.economy
    : (efficiencyPercentFromAudit(input.economicAudit) ?? input.scores.economy);

  const byKey: Record<(typeof RADAR_ROWS)[number]["key"], number> = {
    clinicalAccuracy: clinical,
    legalComplianceGelliBianco: legal,
    prescribingAppropriateness: exams,
    economicSustainability: economy,
    empathy: input.scores.empathy,
  };

  return RADAR_ROWS.map((row) => ({
    key: row.key,
    score: byKey[row.key],
    metric: isLab ? labPillarLabel(row.key, row.metric) : row.metric,
  }));
}
