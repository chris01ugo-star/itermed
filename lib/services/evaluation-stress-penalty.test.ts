/**
 * Malus di comunicazione in base allo stress finale del paziente.
 *
 *   npx tsx --test lib/services/evaluation-stress-penalty.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  communicationStressPenalty,
  computeBehavioralEmpathyScore,
} from "@/lib/services/evaluation-scoring";

describe("communicationStressPenalty", () => {
  it("applies no penalty below 50", () => {
    assert.deepEqual(communicationStressPenalty(49), {
      finalStressLevel: 49,
      stressPenalty: 0,
      criticalPatientStress: false,
    });
  });

  it("subtracts 15 points from 50 through 79", () => {
    assert.equal(communicationStressPenalty(50).stressPenalty, 15);
    assert.equal(communicationStressPenalty(79).criticalPatientStress, false);
    assert.equal(communicationStressPenalty(79).stressPenalty, 15);
  });

  it("subtracts 30 points and flags critical stress from 80", () => {
    const critical = communicationStressPenalty(80);
    assert.equal(critical.stressPenalty, 30);
    assert.equal(critical.criticalPatientStress, true);
    assert.equal(communicationStressPenalty(100).stressPenalty, 30);
  });
});

describe("computeBehavioralEmpathyScore stress", () => {
  it("subtracts the stress malus from the D-RIME score and keeps the floor at zero", () => {
    const calm = computeBehavioralEmpathyScore({ chatHistory: [], finalPatientStress: 20 });
    const agitated = computeBehavioralEmpathyScore({ chatHistory: [], finalPatientStress: 65 });
    const critical = computeBehavioralEmpathyScore({ chatHistory: [], finalPatientStress: 90 });

    assert.equal(agitated.score, Math.max(0, calm.score - 15));
    assert.equal(agitated.breakdown.stressPenalty, 15);
    assert.equal(agitated.breakdown.finalStressLevel, 65);
    assert.equal(agitated.breakdown.criticalPatientStress, false);

    assert.equal(critical.score, Math.max(0, calm.score - 30));
    assert.equal(critical.breakdown.stressPenalty, 30);
    assert.equal(critical.breakdown.criticalPatientStress, true);
    assert.ok(critical.score >= 0);
  });
});
