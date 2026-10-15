/**
 *   npx tsx --test lib/simulator/generatePatientResponse.prompt.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPatientSystemPrompt } from "@/lib/simulator/patient-system-prompt";

describe("patient system prompt constraints", () => {
  it("includes lay-language and acute-pain blocks plus NRS", () => {
    const prompt = buildPatientSystemPrompt({
      patientAge: "58",
      patientSex: "F",
      chiefComplaint: "Dolore al petto",
      vitalSigns: JSON.stringify({ heartRate: 110 }),
      patientStress: 80,
      trueDiagnosis: "STEMI",
      abnormalExams: "(nessuna)",
      clinicalSignsJson: "[]",
      painNrs: 9,
    });

    assert.match(prompt, /\[VINCOLO DI LINGUAGGIO LAICO\]/);
    assert.match(prompt, /È ASSOLUTAMENTE VIETATO usare termini clinici/);
    assert.match(prompt, /\[REAZIONE AL DOLORE ACUTO\]/);
    assert.match(prompt, /superiore a 7\/10/);
    assert.match(prompt, /Dolore attuale \(NRS 0–10\): 9\/10/);
    assert.match(prompt, /antidolorifico/);
    assert.doesNotMatch(prompt, /ROLEPLAY RIGIDO/);
  });

  it("injects the authored roleplay script above the default polite tone", () => {
    const prompt = buildPatientSystemPrompt({
      patientAge: "68",
      patientSex: "M",
      chiefComplaint: "Afasia e emiparesi destra",
      vitalSigns: "{}",
      patientStress: 40,
      trueDiagnosis: "Ictus",
      abnormalExams: "(nessuna)",
      clinicalSignsJson: "[]",
      painNrs: null,
      roleplayScript:
        "ROLEPLAY RIGIDO E SINTOMATOLOGIA FISICA. Registro: AFASIA. Non scrivere frasi complete.",
    });

    assert.match(prompt, /ROLEPLAY RIGIDO E SINTOMATOLOGIA FISICA/);
    assert.match(prompt, /VINCE SUL TONO DI DEFAULT/);
    assert.match(prompt, /Non scrivere frasi complete/);
    assert.match(prompt, /non a un paziente educato e lucido/);
  });
});
