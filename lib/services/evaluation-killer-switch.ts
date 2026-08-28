import type { AnalyticalEvaluation } from "@/lib/services/evaluation-service";
import type { FatalError } from "@/lib/services/evaluation-report-types";
import type { DimensionScores, ScoreBreakdown } from "@/lib/services/evaluation-scoring";
import type { MilestoneScoreBreakdown } from "@/lib/services/evaluation-milestone-scoring";
import {
  MACRO_AREA_WEIGHTS,
  computeTotalScoreTrentesimi,
  dimensionContributionTrentesimi,
} from "@/lib/services/evaluation-scoring";

const KILLER_SWITCH_CAP = 17.9;

/**
 * Life-saving actions only — matched against protocolAction / critical description,
 * NOT against free-text rationales (avoids stroke/ACS keyword false positives).
 */
const FATAL_LIFE_SAVING_ACTION_PATTERN =
  /tc\s*encefal|tac\s*encefal|angio[\s-]?tc|rm\s*encefal|fibrinol|rt[\s-]?pa|alteplase|trombol|perfus(?:ione)?\s*coronar|pci\s*primar|angioplast(?:ica)?\s*primar|ecg\s*12|aspirina|asa\s*carico|doppio\s*antiaggreg|defibrill|rcp\s*avanzat|intubaz|via\s*aerea|adrenalina|epinefrina|adrenalina\s*im/i;

const FATAL_ALLERGY_DRUG_ACTION_PATTERN =
  /allerg|anafil|controindicazion[ei].{0,40}farmac|farmaco.{0,40}controindic/i;

/** Detects clinically fatal errors from structured evaluation checklist. */
export function detectFatalErrors(analytical: AnalyticalEvaluation): FatalError[] {
  const seen = new Set<string>();
  const errors: FatalError[] = [];

  const push = (description: string, rationale: string) => {
    const key = description.slice(0, 80);
    if (seen.has(key)) return;
    seen.add(key);
    errors.push({ description, rationale });
  };

  for (const action of analytical.criticalActions ?? []) {
    if (!action?.performed && action?.criticalLevel === "HIGH") {
      const desc = action.description ?? "";
      // Only treat HIGH omissions as fatal when the omitted action itself is life-saving.
      if (FATAL_LIFE_SAVING_ACTION_PATTERN.test(desc) || FATAL_ALLERGY_DRUG_ACTION_PATTERN.test(desc)) {
        push(desc || "Azione critica salvavita omessa", action.feedback ?? "");
      }
    }
  }

  for (const action of analytical.inappropriateActions ?? []) {
    // High bar: severe contraindicated act (allergy / wrong fibrinolytic, etc.).
    if (action?.performed && (action.penaltyWeight ?? 0) >= 40) {
      const desc = action.description ?? "";
      if (
        FATAL_LIFE_SAVING_ACTION_PATTERN.test(desc) ||
        FATAL_ALLERGY_DRUG_ACTION_PATTERN.test(desc)
      ) {
        push(`Azione inappropriata: ${desc || "n/d"}`, action.feedback ?? "");
      }
    }
  }

  for (const row of analytical.clinicalDeltaTable ?? []) {
    if (!row || (row.status !== "MISSED" && row.status !== "DELAYED")) continue;
    // Match ONLY the protocol action label — never explanatory penalty text.
    const protocol = row.protocolAction ?? "";
    if (!FATAL_LIFE_SAVING_ACTION_PATTERN.test(protocol)) continue;
    if (row.status === "DELAYED") {
      // Delayed life-saving step is fatal only when reason explicitly marks time-critical harm.
      const reason = row.penaltyOrBonusReason ?? "";
      if (!/entro\s*\d|finestra|tempo.?dipendent|ritardo\s*critico|fatale|catastrof/i.test(reason)) {
        continue;
      }
    }
    push(protocol || "Omissione critica salvavita", row.penaltyOrBonusReason ?? "");
  }

  for (const review of analytical.legalInstrumentReviews ?? []) {
    // Any explicit violation of a legal duty is fatal — no hardcoded law name list.
    if (review?.compliance === "violato") {
      push(
        `Violazione normativa: ${review.instrument ?? "obbligo medico-legale"}`,
        review.rationale ?? review.documentTitle ?? "",
      );
    }
  }

  for (const fatal of analytical.fatalErrors ?? []) {
    if (!fatal) continue;
    push(fatal.description ?? "Errore fatale", fatal.rationale ?? "");
  }

  return errors;
}

/** Killer Switch: fatal clinical error caps final grade at ≤17.9/30. */
export function applyKillerSwitch(totalScore: number, fatalErrors: FatalError[]): number {
  if (fatalErrors.length === 0) return totalScore;
  return Math.min(totalScore, KILLER_SWITCH_CAP);
}

export type MacroAreaRationale = {
  label: string;
  weightPercent: number;
  scorePercent: number;
  contributionTrentesimi: number;
  rationale: string;
};

export function buildMacroAreaRationales(
  scores: DimensionScores,
  breakdown: ScoreBreakdown,
  milestoneBreakdown?: MilestoneScoreBreakdown,
): MacroAreaRationale[] {
  const mb = milestoneBreakdown;

  return [
    {
      label: "Accuratezza Clinica",
      weightPercent: MACRO_AREA_WEIGHTS.clinicalDiagnostic * 100,
      scorePercent: scores.clinical,
      contributionTrentesimi: dimensionContributionTrentesimi(
        scores.clinical,
        MACRO_AREA_WEIGHTS.clinicalDiagnostic,
      ),
      rationale: (() => {
        const clin = breakdown.clinical;
        if (clin.iatrogenicCritical) {
          return `Danno Iatrogeno Critico (Classe III ESC/AHA) — Accuratezza 0. Registro: ${(clin.classI?.executed ?? 0)}/${(clin.classI?.expected ?? 0)} Classe I.`;
        }
        const dims = clin.dimensions;
        if (dims) {
          return `ESC/AHA: Classe I ${dims.classIAdherence.met}/${dims.classIAdherence.expected} (${dims.classIAdherence.score}/100) · Classe III evitamento ${dims.classIIIAvoidance.score}/100 · Sequenza ${dims.diagnosticSequencing.score}/100.`;
        }
        return clin.qualitativeLabel
          ? clin.qualitativeLabel
          : `Accuratezza diagnostico-terapeutica: ${clin.final}/100.`;
      })(),
    },
    {
      label: "Sicurezza del Paziente",
      weightPercent: MACRO_AREA_WEIGHTS.legalCompliance * 100,
      scorePercent: scores.legal,
      contributionTrentesimi: dimensionContributionTrentesimi(
        scores.legal,
        MACRO_AREA_WEIGHTS.legalCompliance,
      ),
      rationale: (() => {
        const leg = breakdown.legal;
        const n = leg.rilievi?.length ?? 0;
        const status = leg.formalLabel || leg.conformityStatus || "n/d";
        const src = leg.sourceRef ? ` · ${leg.sourceRef}` : "";
        return `${status} — ${n} rilievi medico-legali deduplicati (motore RAG specialty)${src}.`;
      })(),
    },
    {
      label: "Appropriatezza Prescrittiva (Esami)",
      weightPercent: MACRO_AREA_WEIGHTS.examAppropriateness * 100,
      scorePercent: scores.exams,
      contributionTrentesimi: dimensionContributionTrentesimi(
        scores.exams,
        MACRO_AREA_WEIGHTS.examAppropriateness,
      ),
      rationale: mb
        ? `Base 100% − ${mb.appropriateness.penaltyPercent}% (${mb.appropriateness.inappropriateCount} inappropriate + ${mb.appropriateness.tier3WithoutIndication} esami III livello senza indicazione). Economia HTA: effettiva €${breakdown.economy.totalCostEuro.toFixed(2)} vs ideale €${(breakdown.economy.idealSpendEuro ?? breakdown.economy.budgetEuro).toFixed(2)} · efficienza ${breakdown.economy.efficiencyPercent ?? "n/d"}% (radar, esclusa dal /30).`
        : `Appropriatezza prescrittiva (scores.exams): ${breakdown.exams.final}/100. Economia HTA efficienza ${breakdown.economy.efficiencyPercent ?? breakdown.economy.final}% (esclusa dal /30).`,
    },
    {
      label: "Comunicazione e Relazione Clinica",
      weightPercent: MACRO_AREA_WEIGHTS.empathy * 100,
      scorePercent: scores.empathy,
      contributionTrentesimi: dimensionContributionTrentesimi(
        scores.empathy,
        MACRO_AREA_WEIGHTS.empathy,
      ),
      rationale: (() => {
        const emp = breakdown.empathy;
        const dims = emp.dimensions;
        const dimLine = emp.dRime
          ? `D-RIME: SPIKES ${emp.dRime.spikesEmpathyScore} · RIAS ${emp.dRime.riasAlignmentScore} · CARE ${emp.dRime.careTrustScore} · Alleanza ${emp.dRime.allianceScore}`
          : dims
            ? `A ascolto ${dims.activeListening.score}/100 · B validazione ${dims.emotionalValidation.score}/100 · C contesto ${dims.clinicalContext.score}/100 (D-RIME)`
            : emp.qualitativeLabel || `Comunicazione ${emp.final}/100`;
        const mil = mb
          ? ` · milestone telemetria ${mb.empathy.met}/${mb.empathy.expected}`
          : "";
        return `${dimLine}${mil}.`;
      })(),
    },
  ];
}

export function computeFinalTrentesimiWithKillerSwitch(
  scores: DimensionScores,
  fatalErrors: FatalError[],
): {
  rawTotal: number;
  finalTotal: number;
  killerSwitchApplied: boolean;
  /** @deprecated Kept for callers — identical to scoresForPersist (cap-only, no pillar wipe). */
  adjustedScoresForTotal: DimensionScores;
  /** Authentic dimension scores for SessionReport columns / UI radar. */
  scoresForPersist: DimensionScores;
} {
  const scoresForPersist = { ...scores };
  // Cap-only: never zero legal/empathy for the total math — partials stay authentic in DB/UI.
  const rawTotal = computeTotalScoreTrentesimi(scores);
  const finalTotal = applyKillerSwitch(rawTotal, fatalErrors);
  return {
    rawTotal,
    finalTotal,
    killerSwitchApplied: fatalErrors.length > 0,
    adjustedScoresForTotal: scoresForPersist,
    scoresForPersist,
  };
}

export { computeTotalScoreTrentesimi };
