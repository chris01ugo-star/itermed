import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isActionIdExecuted } from "@/lib/services/evaluation-clinical-esc";
import {
  MACRO_AREA_WEIGHTS,
  computeTotalScoreTrentesimi,
  dimensionContributionTrentesimi,
} from "@/lib/services/evaluation-scoring";
import {
  boundedRagAdjustment,
  composeHybridPillarScores,
  stampWaterfallFinals,
  waterfallFinals,
  type HybridScoreInput,
} from "@/lib/services/hybrid-pillar-scoring";
import {
  buildUnifiedSimulationTrace,
  containsCorrectSolutionKey,
  formatUnifiedTraceForPrompt,
  toPublicRefertoFields,
} from "@/lib/services/unified-simulation-trace";

const baseInput: HybridScoreInput = {
  matrixClinical: 80,
  clinicalAuditScore: 60,
  clinicalAuditEvaluable: true,
  timeMalusFraction: 0.2,
  failedDiagnosisAttempts: 1,
  clinicalKiller: false,
  legalBase: 78,
  informedConsent: true,
  dischargeValid: true,
  legalSevereCap: false,
  appropriatenessScore: 70,
  physicalExamDelta: 4,
  economyScore: 40,
  economyComment: "Spreco su un esame ridondante.",
  empathyComposite: 90,
  finalStress: 85,
  ragClinical: { score: 10, feedback: "Scostamento dalla linea guida ESC." },
  ragLegal: { score: 100, feedback: "Conforme all'art. 5 della Legge 24/2017." },
};

describe("hybrid pillar scoring", () => {
  it("recognizes hyphen and underscore as the same action id", () => {
    assert.equal(isActionIdExecuted("ecg-12", new Set(["ecg_12"]), []), true);
    assert.equal(isActionIdExecuted("ecg-12", new Set(["troponin"]), []), false);
  });

  it("keeps time, wrong diagnosis, stress and fatal allergy after the RAG nudge", () => {
    const scored = composeHybridPillarScores(baseInput);
    assert.ok(scored.scores.clinical < 80);
    assert.ok(scored.scores.clinical > 0);
    const kinds = scored.waterfall.clinical.map((step) => step.kind);
    assert.ok(kinds.includes("penalty"));
    assert.equal(scored.waterfall.clinical.some((step) => step.label === "Diagnosi errate"), true);
    assert.equal(scored.waterfall.clinical.some((step) => step.label === "Malus tempo"), true);
    assert.equal(scored.scores.empathy, 60);

    const killed = composeHybridPillarScores({
      ...baseInput,
      clinicalKiller: true,
      ragClinical: { score: 100, feedback: "Linea guida ESC rispettata." },
    });
    assert.equal(killed.scores.clinical, 0);
    assert.equal(
      boundedRagAdjustment({
        deterministic: 0,
        ragScore: 100,
        feedback: "Linea guida ESC",
        frozen: true,
      }),
      0,
    );
  });

  it("does not let RAG replace a pillar", () => {
    const scored = composeHybridPillarScores({
      ...baseInput,
      timeMalusFraction: 0,
      failedDiagnosisAttempts: 0,
      ragClinical: { score: 0, feedback: "Violazione della linea guida ESC." },
    });
    assert.ok(scored.scores.clinical >= 60);
    assert.notEqual(scored.scores.clinical, 0);
  });

  it("keeps exams and economy independent", () => {
    const scored = composeHybridPillarScores(baseInput);
    assert.notEqual(scored.scores.exams, scored.scores.economy);
    assert.equal(scored.scores.economy, 40);
    assert.equal(scored.scores.exams, 74);
  });

  it("exposes one legal score for the pillar and the CTU section", () => {
    const scored = composeHybridPillarScores(baseInput);
    const stamped = stampWaterfallFinals(scored.waterfall, scored.scores);
    assert.equal(waterfallFinals(stamped).legal, scored.scores.legal);
    const capped = composeHybridPillarScores({
      ...baseInput,
      legalBase: 90,
      legalSevereCap: true,
      dischargeValid: false,
    });
    assert.ok(capped.scores.legal <= 35);
    const consented = composeHybridPillarScores(baseInput);
    assert.ok(consented.scores.legal > 0);
  });

  it("matches the trentesimi total to the five contributions", () => {
    const scored = composeHybridPillarScores(baseInput);
    const weights = MACRO_AREA_WEIGHTS;
    const contributions = [
      dimensionContributionTrentesimi(scored.scores.clinical, weights.clinicalDiagnostic),
      dimensionContributionTrentesimi(scored.scores.legal, weights.legalCompliance),
      dimensionContributionTrentesimi(scored.scores.exams, weights.examAppropriateness),
      dimensionContributionTrentesimi(scored.scores.empathy, weights.empathy),
      dimensionContributionTrentesimi(scored.scores.economy, weights.economicSustainability),
    ];
    const sum = Math.round(contributions.reduce((acc, value) => acc + value, 0) * 10) / 10;
    assert.equal(sum, computeTotalScoreTrentesimi(scored.scores));
    const stamped = stampWaterfallFinals(scored.waterfall, scored.scores);
    assert.deepEqual(waterfallFinals(stamped), scored.scores);
  });
});

describe("unified simulation trace", () => {
  it("keeps every maneuver and every exam report", () => {
    const trace = buildUnifiedSimulationTrace({
      chatHistory: [{ role: "user", content: "Da quanto ha dolore?" }],
      physicalExams: [
        { id: "blood-pressure", name: "Pressione arteriosa", finding: "150/90 mmHg" },
        { id: "auscultation", name: "Auscultazione cardiaca", finding: "Soffio sistolico" },
      ],
      requestedExamIds: ["ecg", "troponin"],
      exams: [
        { id: "ecg", name: "ECG", cost: 20 },
        { id: "troponin", name: "Troponina", cost: 15 },
      ],
      examOverrides: {
        ecg: { summary: "Sopraslivellamento anteriore", isAbnormal: true, formattedText: "ECG: STEMI anteriore" },
      },
      indicatedExamIds: ["ecg", "troponin"],
      correctSolution: "SEGRETO-NON-PUBBLICARE",
      diagnosisEntered: "angina",
    });
    const prompt = formatUnifiedTraceForPrompt(trace);
    assert.match(prompt, /Pressione arteriosa/);
    assert.match(prompt, /Auscultazione cardiaca/);
    assert.match(prompt, /Sopraslivellamento anteriore/);
    assert.equal(JSON.stringify(trace).includes("SEGRETO-NON-PUBBLICARE"), false);
    assert.equal(trace.diagnosis.matchesReference, false);
  });

  it("keeps the public referto free of correctSolution", () => {
    const view = toPublicRefertoFields({
      correctSolution: "STEMI",
      feedback: { correctSolution: "STEMI" },
      scoreWaterfall: { clinical: [] },
    });
    assert.equal(containsCorrectSolutionKey(view), false);
  });
});
