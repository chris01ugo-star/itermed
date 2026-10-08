/**
 * Documento di consenso nel log letto dalla CTU.
 *
 *   npx tsx --test lib/services/legal-audit-consent.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  composeClinicalReport,
  isClinicalReportComplete,
} from "@/components/simulator/ClinicalDischargeReportPanel";
import {
  LEGAL_AUDIT_SYSTEM_PROMPT,
  withInformedConsentAction,
} from "@/lib/services/legal-audit-service";

describe("informed consent in the CTU log", () => {
  it("adds the informed_consent document only when the module was used", () => {
    const exams = [{ id: "ecg", type: "ACTION" as const, name: "ECG" }];
    assert.deepEqual(withInformedConsentAction(exams, false), exams);
    assert.deepEqual(withInformedConsentAction(exams, true), [
      ...exams,
      {
        id: "informed_consent",
        type: "DOCUMENT",
        name: "Consenso informato acquisito",
      },
    ]);
  });

  it("tells the CTU not to apply the consent penalty when the document is present", () => {
    assert.match(LEGAL_AUDIT_SYSTEM_PROMPT, /informed_consent/);
    assert.match(LEGAL_AUDIT_SYSTEM_PROMPT, /NON applicare la penalità di -30/);
    assert.match(LEGAL_AUDIT_SYSTEM_PROMPT, /NON applicare la penalità per documentazione mancante/);
  });
});

describe("discharge note", () => {
  const sections = {
    anamnesisObjective: "Dolore toracico da due ore, dispnea, familiarità coronarica.",
    diagnosticFindings: "ECG con sopraslivellamento anteriore e troponina in ascesa.",
    diagnosisTreatment: "STEMI anteriore. Doppia antiaggregazione e invio in emodinamica.",
    dischargeNote:
      "Razionale: sindrome coronarica acuta. Reperti: ECG e troponina. Follow-up cardiologico e red flags spiegate.",
  };

  it("includes the discharge diary in the composed report and requires it to close", () => {
    assert.match(composeClinicalReport(sections), /DIARIO CLINICO \/ RELAZIONE DI DIMISSIONE/);
    assert.equal(isClinicalReportComplete(sections), true);
    assert.equal(isClinicalReportComplete({ ...sections, dischargeNote: "breve" }), false);
  });
});
