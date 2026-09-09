import type { FatalError, MacroAreaScore, ReportDashboardPayload } from "@/lib/services/evaluation-report-types";
import type { MacroAreaRationale } from "@/lib/services/evaluation-killer-switch";

const MACRO_KEYS: MacroAreaScore["key"][] = ["clinical", "legal", "economy", "empathy"];

const SHORT_LABELS: Record<MacroAreaScore["key"], string> = {
  clinical: "Accuratezza",
  legal: "Sicurezza",
  economy: "Appropriatezza",
  empathy: "Comunicazione",
};

/** Builds structured JSON for the React Report Dashboard. */
export function buildReportDashboardPayload(params: {
  macroAreas: MacroAreaRationale[];
  finalScore: number;
  rawScore: number;
  killerSwitchApplied: boolean;
  fatalErrors: FatalError[];
}): ReportDashboardPayload {
  const macroAreaScores: MacroAreaScore[] = params.macroAreas.map((area, index) => ({
    key: MACRO_KEYS[index] ?? "clinical",
    label: area.label,
    shortLabel: SHORT_LABELS[MACRO_KEYS[index] ?? "clinical"],
    weightPercent: area.weightPercent,
    scorePercent: area.scorePercent,
    contributionTrentesimi: area.contributionTrentesimi,
    rationale: area.rationale,
  }));

  return {
    version: 1,
    finalScore: params.finalScore,
    rawScore: params.rawScore,
    killerSwitchApplied: params.killerSwitchApplied,
    macroAreas: macroAreaScores,
    radarData: macroAreaScores.map((area) => ({
      metric: area.shortLabel,
      score: area.scorePercent,
      fullMark: 100,
    })),
    fatalErrors: params.fatalErrors,
  };
}
