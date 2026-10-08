/**
 * Malus clinico per sforamento di timeLimitMinutes.
 *
 *   npx tsx --test lib/services/evaluation-time-penalty.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLINICAL_TIME_CRITICAL_MALUS,
  CLINICAL_TIME_LINEAR_MAX_MALUS,
  clinicalTimeMalusFraction,
  computeClinicalAccuracyScore,
} from "@/lib/services/evaluation-scoring";

describe("clinicalTimeMalusFraction", () => {
  it("applies no malus at or under the limit", () => {
    assert.deepEqual(clinicalTimeMalusFraction(30, 30), {
      overrunRatio: 0,
      malusFraction: 0,
      criticalTimeDelay: false,
    });
    assert.equal(clinicalTimeMalusFraction(20, 30).malusFraction, 0);
  });

  it("scales linearly up to -15% at +50% overrun", () => {
    const quarter = clinicalTimeMalusFraction(37.5, 30);
    assert.equal(quarter.overrunRatio, 0.25);
    assert.equal(quarter.malusFraction, CLINICAL_TIME_LINEAR_MAX_MALUS * 0.5);
    assert.equal(quarter.criticalTimeDelay, false);

    const cap = clinicalTimeMalusFraction(45, 30);
    assert.equal(cap.overrunRatio, 0.5);
    assert.equal(cap.malusFraction, CLINICAL_TIME_LINEAR_MAX_MALUS);
    assert.equal(cap.criticalTimeDelay, false);
  });

  it("applies a fixed -25% and the critical flag above +50%", () => {
    const over = clinicalTimeMalusFraction(46, 30);
    assert.ok(over.overrunRatio > 0.5);
    assert.equal(over.malusFraction, CLINICAL_TIME_CRITICAL_MALUS);
    assert.equal(over.criticalTimeDelay, true);
  });
});

describe("computeClinicalAccuracyScore time penalty", () => {
  const perfect = [
    {
      description: "ECG 12 derivazioni",
      criticalLevel: "HIGH" as const,
      performed: true,
      feedback: "",
    },
  ];

  it("leaves a perfect clinical score unchanged inside the limit", () => {
    const result = computeClinicalAccuracyScore(perfect, {
      elapsedMinutes: 30,
      timeLimitMinutes: 30,
    });
    assert.equal(result.score, 100);
    assert.equal(result.breakdown.criticalTimeDelay, false);
    assert.equal(result.breakdown.timeMalusFraction, 0);
  });

  it("cuts 15% of the clinical score at the top of the linear band", () => {
    const result = computeClinicalAccuracyScore(perfect, {
      elapsedMinutes: 45,
      timeLimitMinutes: 30,
    });
    assert.equal(result.score, 85);
    assert.equal(result.breakdown.final, 85);
    assert.equal(result.breakdown.criticalTimeDelay, false);
  });

  it("cuts 25% and flags criticalTimeDelay past +50%", () => {
    const result = computeClinicalAccuracyScore(perfect, {
      elapsedMinutes: 60,
      timeLimitMinutes: 30,
    });
    assert.equal(result.score, 75);
    assert.equal(result.breakdown.criticalTimeDelay, true);
    assert.equal(result.breakdown.timeMalusFraction, 0.25);
  });

  it("does not penalise when the clock or the limit is missing", () => {
    const result = computeClinicalAccuracyScore(perfect, { elapsedMinutes: 90 });
    assert.equal(result.score, 100);
    assert.equal(result.breakdown.criticalTimeDelay, undefined);
  });
});
