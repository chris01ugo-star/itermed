/**
 * Zero-trust play payload: gold path / scoring keys must never reach the browser.
 *
 *   npx tsx --test lib/cases/case-payload.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PLAY_SESSION_FORBIDDEN_KEYS,
  buildSimulatorCasePayload,
  findPlaySessionEvaluationLeaks,
  sanitizeBaselineForClient,
} from "@/lib/cases/case-payload";

const DIRTY_BASELINE = {
  demographics: { age: 58, sex: "M", context: "PS" },
  vitals: { heartRate: 96, bloodPressure: "150/95", spo2: 96, temperature: 36.5, respiratoryRate: 18 },
  physicalExam: { finding: "Paziente inquieto." },
  ecg: { finding: "ST underslivellato." },
  goldStandardPath: ["ecg", "troponina"],
  correctSolution: "SCA NSTEMI",
  diagnosis: "NSTEMI",
  anamnesisQuestions: [{ id: "q1", expectedKeywords: ["dolore"] }],
  mandatoryExams: [{ examId: "ecg" }],
  inappropriateExams: [{ examId: "pet-tc" }],
  legalConformity: { criteria: [] },
  patientProfile: { healthLiteracy: "HIGH" },
  auditMetrics: { appropriatenessIndicators: ["x"] },
  escCitations: [{ source: "ESC" }],
  goldPathNarrative: "Fare ECG poi troponina",
  stressProfile: {
    initialStress: 55,
    reactivityType: "hyper",
    timeDecayRate: 1.8,
    lifesavingMilestones: ["ecg", "troponina"],
    relievingExams: ["ecg"],
    criticalMilestones: { reduceStress: ["richiesto_ecg"], increaseStress: ["ritardo_ecg"] },
    dangerousPrescriptions: ["pet-tc"],
  },
};

describe("play-session zero-trust serializer", () => {
  it("strips gold path, scoring checklists, and stress milestones from baseline", () => {
    const clean = sanitizeBaselineForClient(DIRTY_BASELINE);
    for (const key of PLAY_SESSION_FORBIDDEN_KEYS) {
      assert.equal(Object.prototype.hasOwnProperty.call(clean, key), false, `leaked ${key}`);
    }
    assert.ok(clean.vitals);
    assert.ok(clean.ecg);
    assert.deepEqual(clean.stressProfile, {
      initialStress: 55,
      reactivityType: "hyper",
      timeDecayRate: 1.8,
    });
  });

  it("buildSimulatorCasePayload never copies goldStandardPath or correctSolution", () => {
    const payload = buildSimulatorCasePayload({
      id: "CARDIO-001",
      title: "Dolore toracico",
      description: "Uomo 58 anni in PS",
      specialty: "Cardiologia",
      difficulty: "MEDIUM",
      estimatedDurationMinutes: 45,
      patientPrompt: "Sei Paolo, hai un peso sullo sterno.",
      baselineExamFindings: DIRTY_BASELINE,
      timeLimitMinutes: 45,
      goldStandardPath: ["ecg", "troponina", "consenso-informato"],
      correctSolution: "SCA — ECG entro 10 minuti",
      examLatencies: { ecg: 5, troponina: 40 },
      patientDeteriorationThreshold: 20,
    });

    assert.equal("goldStandardPath" in payload, false);
    assert.equal("correctSolution" in payload, false);
    assert.equal("examLatencies" in payload, false);
    assert.equal("patientDeteriorationThreshold" in payload, false);
    assert.equal(payload.patientPrompt.includes("Paolo"), true);

    const leaks = findPlaySessionEvaluationLeaks(payload);
    assert.deepEqual(leaks, []);
  });
});
