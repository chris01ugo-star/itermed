/**
 *   npx tsx --test lib/simulator/patientCaseContext.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPatientSimulatorCaseInput,
  formatVitalSignsFromBaseline,
  parsePainNrs,
} from "@/lib/simulator/patientCaseContext";

const BASELINE = {
  demographics: { age: 71, sex: "F" },
  vitals: {
    bloodPressure: "140/90",
    heartRate: 88,
    spo2: 96,
    temperature: 36.6,
    respiratoryRate: 18,
    bp: "140/90",
    hr: 88,
  },
};

describe("patientCaseContext vitals SSOT", () => {
  it("formats the identical canonical JSON for the patient prompt", () => {
    const json = formatVitalSignsFromBaseline(BASELINE);
    assert.equal(
      json,
      JSON.stringify({
        heartRate: 88,
        bloodPressure: "140/90",
        spo2: 96,
        temperature: 36.6,
        respiratoryRate: 18,
      }),
    );
  });

  it("injects DB baseline JSON and ignores contradictory client monitor values", () => {
    const input = buildPatientSimulatorCaseInput({
      body: {
        vitalSigns: "FC 62; PA 110/70; SpO₂ 99%",
        patientSex: "F",
      },
      clinicalCase: {
        description: "Palpitazioni",
        correctSolution: "FA-ARV",
        baselineExamFindings: BASELINE,
      },
      patientStress: 40,
    });
    assert.equal(input.vitalSigns, formatVitalSignsFromBaseline(BASELINE));
    assert.match(input.vitalSigns, /"bloodPressure":"140\/90"/);
    assert.doesNotMatch(input.vitalSigns, /110\/70/);
  });

  it("injects clinicalSigns JSON for the semeiotics prompt block", () => {
    const input = buildPatientSimulatorCaseInput({
      body: {},
      clinicalCase: {
        description: "Dolore in ipocondrio destro",
        correctSolution: "Colecistite",
        baselineExamFindings: {
          ...BASELINE,
          clinicalSigns: [
            {
              signName: "Segno di Murphy",
              result: "Positivo, interruzione dell'atto respiratorio",
              isPositive: true,
            },
          ],
        },
      },
      patientStress: 30,
    });
    assert.match(input.clinicalSignsJson, /"signName":"Segno di Murphy"/);
    assert.match(input.clinicalSignsJson, /"isPositive":true/);
  });
});

describe("parsePainNrs", () => {
  it("reads NRS from baseline.pain.nrs", () => {
    assert.equal(parsePainNrs({ pain: { nrs: 8 } }), 8);
  });

  it("reads NRS from vitals.painScore and 8/10 strings", () => {
    assert.equal(parsePainNrs({ vitals: { painScore: 9 } }), 9);
    assert.equal(parsePainNrs({ pain: { intensity: "8/10" } }), 8);
  });

  it("reads NRS from chief-complaint text when baseline has none", () => {
    assert.equal(parsePainNrs(null, "Dolore toracico NRS 8 da 40 minuti"), 8);
  });

  it("injects painNrs into the patient case input", () => {
    const input = buildPatientSimulatorCaseInput({
      body: {},
      clinicalCase: {
        description: "Dolore toracico",
        correctSolution: "STEMI",
        baselineExamFindings: {
          ...BASELINE,
          pain: { nrs: 9 },
        },
      },
      patientStress: 80,
    });
    assert.equal(input.painNrs, 9);
  });
});
