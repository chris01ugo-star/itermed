/**
 * Malus clinico per diagnosi finali errate.
 *
 *   npx tsx --test lib/services/evaluation-diagnosis-penalty.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DIAGNOSIS_ATTEMPT_PENALTY_POINTS,
  computeClinicalAccuracyScore,
} from "@/lib/services/evaluation-scoring";

const perfect = [
  {
    description: "ECG 12 derivazioni",
    criticalLevel: "HIGH" as const,
    performed: true,
    feedback: "",
  },
];

describe("failed diagnosis penalty", () => {
  it("leaves the clinical score unchanged when every attempt was correct", () => {
    const result = computeClinicalAccuracyScore(perfect, { failedDiagnosisAttempts: 0 });
    assert.equal(result.score, 100);
    assert.equal(result.breakdown.failedDiagnosisCount, 0);
    assert.equal(result.breakdown.diagnosisPenalty, 0);
  });

  it("subtracts 10 clinical points for each wrong final diagnosis", () => {
    const result = computeClinicalAccuracyScore(perfect, { failedDiagnosisAttempts: 2 });
    assert.equal(DIAGNOSIS_ATTEMPT_PENALTY_POINTS, 10);
    assert.equal(result.breakdown.failedDiagnosisCount, 2);
    assert.equal(result.breakdown.diagnosisPenalty, 20);
    assert.equal(result.score, 80);
    assert.equal(result.breakdown.final, 80);
  });

  it("never drops the clinical score below zero", () => {
    const result = computeClinicalAccuracyScore(perfect, { failedDiagnosisAttempts: 12 });
    assert.equal(result.breakdown.diagnosisPenalty, 120);
    assert.equal(result.score, 0);
  });

  it("applies the diagnosis malus after the time malus", () => {
    const result = computeClinicalAccuracyScore(perfect, {
      elapsedMinutes: 45,
      timeLimitMinutes: 30,
      failedDiagnosisAttempts: 1,
    });
    assert.equal(result.breakdown.timeMalusFraction, 0.15);
    assert.equal(result.breakdown.diagnosisPenalty, 10);
    assert.equal(result.score, 75);
  });
});
