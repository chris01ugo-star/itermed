import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  detectEcgAction,
  detectOxygenSupport,
  formatBloodPressureFinding,
  goldPathProgress,
  parseBaselineVitals,
  resolveMonitorVitals,
} from "@/lib/clinical/case-vitals";

describe("case-vitals", () => {
  it("parses baseline vitals without inventing hypoxia", () => {
    const parsed = parseBaselineVitals({
      vitals: {
        heartRate: 88,
        bloodPressure: "130/80",
        spo2: 96,
        temperature: 36.6,
        respiratoryRate: 18,
      },
    });
    assert.ok(parsed);
    assert.equal(parsed!.spo2, 96);
    assert.equal(parsed!.hr, 88);
  });

  it("does not crash SpO2 from behavioral stress alone", () => {
    const baseline = {
      vitals: {
        heartRate: 80,
        bloodPressure: "120/75",
        spo2: 97,
        temperature: 36.5,
        respiratoryRate: 16,
      },
    };
    const calm = resolveMonitorVitals({
      caseId: "CARDIO-001",
      baselineExamFindings: baseline,
      clockMinutes: 2,
      behavioralStress: 90,
    });
    assert.ok(calm.spo2 >= 94, `expected SpO2>=94 got ${calm.spo2}`);
  });

  it("worsens slowly with time inertia and improves with oxygen", () => {
    const baseline = {
      vitals: {
        heartRate: 98,
        bloodPressure: "130/85",
        spo2: 95,
        temperature: 36.6,
        respiratoryRate: 22,
      },
    };
    const late = resolveMonitorVitals({
      caseId: "CARDIO-001",
      baselineExamFindings: baseline,
      clockMinutes: 40,
      deteriorationThresholdMinutes: 25,
      caseContext: "STEMI dolore toracico",
      specialty: "cardiologia",
      behavioralStress: 20,
    });
    const withO2 = resolveMonitorVitals({
      caseId: "CARDIO-001",
      baselineExamFindings: baseline,
      clockMinutes: 40,
      deteriorationThresholdMinutes: 25,
      caseContext: "STEMI dolore toracico",
      specialty: "cardiologia",
      behavioralStress: 20,
      stabilization: { hasOxygen: true, goldProgress: 0.4 },
    });
    assert.ok(late.spo2 < 95, `late SpO2 should drop, got ${late.spo2}`);
    assert.ok(withO2.spo2 > late.spo2, `O2 should improve SpO2 (${withO2.spo2} vs ${late.spo2})`);
  });

  it("detects oxygen/ECG and gold progress", () => {
    assert.equal(detectOxygenSupport(["ossigenoterapia", "ecg"]), true);
    assert.equal(detectEcgAction(["troponina", "ecg"]), true);
    assert.equal(goldPathProgress(["ecg", "troponina"], ["ecg"]), 0.5);
  });

  it("formats NIBP from baseline including arm asymmetry", () => {
    const simple = formatBloodPressureFinding({
      vitals: { bloodPressure: "130 / 80" },
    });
    assert.equal(simple?.finding, "Pressione arteriosa 130/80 mmHg");

    const asymmetric = formatBloodPressureFinding({
      vitals: {
        bloodPressure: "170/95 (Dx) · 125/70 (Sx)",
        bloodPressureRight: "170/95",
        bloodPressureLeft: "125/70",
      },
    });
    assert.equal(
      asymmetric?.finding,
      "Pressione arteriosa Dx 170/95 mmHg · Sx 125/70 mmHg",
    );
  });
});
