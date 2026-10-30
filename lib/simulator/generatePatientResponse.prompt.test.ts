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

    assert.match(prompt, /Sei il paziente in questa simulazione medica/);
    assert.match(prompt, /Sesso biologico\/Genere grammaticale: DONNA\/FEMMINA/);
    assert.match(prompt, /CONCORDANZA GRAMMATICALE ITALIANA/);
    assert.match(prompt, /sono stanca/);
    assert.match(prompt, /sono venuta/);
    assert.match(prompt, /sono preoccupata/);
    assert.match(prompt, /MAI 'sono stanco'/);
    assert.match(prompt, /PERSONALITÀ E STATO EMOTIVO/);
    assert.match(prompt, /RISPOSTA DIRETTA/);
    assert.match(prompt, /\[VINCOLO DI LINGUAGGIO LAICO\]/);
    assert.match(prompt, /È ASSOLUTAMENTE VIETATO usare termini clinici/);
    assert.match(prompt, /\[REAZIONE AL DOLORE ACUTO\]/);
    assert.match(prompt, /superiore a 7\/10/);
    assert.match(prompt, /Dolore attuale \(NRS 0–10\): 9\/10/);
    assert.match(prompt, /antidolorifico/);
    assert.doesNotMatch(prompt, /ROLEPLAY RIGIDO/);
    assert.match(prompt, /sei ansiosa per aver letto/);
    assert.doesNotMatch(prompt, /sei ansioso per aver letto/);
  });

  it("infers a female persona from the roleplay script when sex is missing", () => {
    const prompt = buildPatientSystemPrompt({
      patientAge: "44",
      patientSex: "(non specificato)",
      chiefComplaint: "Dispnea",
      vitalSigns: "{}",
      patientStress: 30,
      trueDiagnosis: "Embolia",
      abnormalExams: "(nessuna)",
      clinicalSignsJson: "[]",
      painNrs: null,
      roleplayScript: "Sei Federica, 44 anni. Sono molto stanca.",
    });

    assert.match(prompt, /Nome: Federica/);
    assert.match(prompt, /DONNA\/FEMMINA/);
    assert.match(prompt, /sono stanca/);
    assert.match(prompt, /sono un po' preoccupata/);
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
