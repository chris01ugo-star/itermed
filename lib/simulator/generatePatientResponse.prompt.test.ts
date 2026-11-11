/**
 *   npx tsx --test lib/simulator/generatePatientResponse.prompt.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPatientSystemPrompt } from "@/lib/simulator/patient-system-prompt";

describe("patient system prompt", () => {
  it("puts identity and the four golden rules in one short prompt", () => {
    const prompt = buildPatientSystemPrompt({
      patientAge: "58",
      patientSex: "F",
      chiefComplaint: "Dolore al petto",
      clinicalStory: "Dolore al petto da un'ora",
      vitalSigns: JSON.stringify({ heartRate: 110 }),
      patientStress: 80,
      trueDiagnosis: "STEMI",
      abnormalExams: "(nessuna)",
      clinicalSignsJson: "[]",
      painNrs: 9,
    });

    assert.match(prompt, /ADESSO SEI SOLO QUESTO PAZIENTE/);
    assert.match(prompt, /DONNA\/FEMMINA/);
    assert.match(prompt, /femminile/);
    assert.match(prompt, /Dolore al petto da un'ora/);
    assert.match(prompt, /Dolore: 9\/10/);
    assert.match(prompt, /COME GESTIRE IL TUO COPIONE/);
    assert.match(prompt, /racconta SOLO come ti senti/);
    assert.match(prompt, /vorrebbe sapere/);
    assert.match(prompt, /Diagnosi da non dire: STEMI/);
    assert.doesNotMatch(prompt, /sono stanca/);
    assert.doesNotMatch(prompt, /CLOSED-WORLD/);
    assert.doesNotMatch(prompt, /DIRETTIVA DI SICUREZZA/);
    assert.ok(prompt.indexOf("Dolore al petto da un'ora") > prompt.indexOf("ADESSO SEI SOLO QUESTO PAZIENTE"));
  });

  it("turns a third-person ward story into lived experience and keeps the script", () => {
    const prompt = buildPatientSystemPrompt({
      patientAge: "87",
      patientName: "Ettore Barbieri",
      patientSex: "M",
      chiefComplaint: "Allettamento",
      clinicalStory:
        "Ettore Barbieri, 87 anni, è in reparto da cinque giorni. Bellelli dice di prevenire l'immobilizzazione.",
      vitalSigns: "{}",
      patientStress: 20,
      trueDiagnosis: "Decondizionamento",
      abnormalExams: "Esame obiettivo: eritema sacrale",
      clinicalSignsJson: "[]",
      painNrs: null,
      roleplayScript:
        "ROLEPLAY. Sei Ettore Barbieri, 87 anni, lucido. Dici che sei a letto da giorni e ti fa male la schiena.",
    });

    assert.match(prompt, /Nome: Ettore/);
    assert.match(prompt, /Ettore Barbieri, 87 anni/);
    assert.match(prompt, /UOMO\/MASCHIO/);
    assert.match(prompt, /Dici che sei a letto da giorni/);
    assert.match(prompt, /in reparto da cinque giorni/);
    assert.match(prompt, /note per il medico/);
    assert.match(prompt, /nota di regia/);
    assert.match(prompt, /eritema sacrale/);
  });

  it("drops the placeholder script and does not treat it as the persona", () => {
    const prompt = buildPatientSystemPrompt({
      patientAge: "70",
      patientSex: "F",
      chiefComplaint: "Dispnea",
      clinicalStory: "È in reparto per una bronchite.",
      vitalSigns: "{}",
      patientStress: 10,
      trueDiagnosis: "(non definita nel caso)",
      abnormalExams: "(nessuna sensazione fisica esplicitata oltre al copione — non inventare esami)",
      clinicalSignsJson: "[]",
      painNrs: null,
      roleplayScript:
        "Paziente in simulazione. Rispondi come paziente, senza diagnosi e senza valori vitali a voce.",
    });

    assert.match(prompt, /non c'è un copione separato/);
    assert.match(prompt, /bronchite/);
    assert.doesNotMatch(prompt, /Paziente in simulazione/);
    assert.doesNotMatch(prompt, /NON inventare un punteggio/);
  });

  it("embodies a guideline-only hematology case as lived symptoms", () => {
    const prompt = buildPatientSystemPrompt({
      patientAge: "57",
      patientName: "Sara",
      patientSex: "F",
      chiefComplaint: "Blasti midollari 28%",
      clinicalStory: "Blasti midollari 28%, nessuna genetica ancora. FLT3, IDH1, IDH2 e NPM1 si cercano.",
      setting: "REPARTO",
      condition: "Sospetta leucemia mieloide acuta, genetica non ancora disponibile",
      presentation: "Qualcuno vuole chiamarla mielodisplasia perché i blasti non sono 30.",
      pastMedicalHistory: "Donna di 57 anni, fit, blasti midollari 28%, emocromo con pancitopenia.",
      redHerrings: ["Midostaurin senza FLT3."],
      anamnesisClues: [
        {
          prompt: "Si può dare midostaurin prima del FLT3?",
          rationale: "Il midostaurin è nella riga FLT3 mutato.",
        },
      ],
      physicalExamSummary: "Pallida, niente sanguinamento maggiore.",
      patientProfile: {
        healthLiteracy: "MEDIUM",
        emotionalState: "ANXIOUS",
        adherence: "FULL",
        lifestyleAndSocial: {
          sleepQuality: "FAIR",
          stressLevel: "HIGH",
          socialSupport: "ADEQUATE",
        },
        communicationStyle: "Accetta il midollo, rifiuta un farmaco scelto a caso.",
      },
      vitalSigns: JSON.stringify({ spo2: 88, respiratoryRate: 28, heartRate: 110 }),
      patientStress: 40,
      trueDiagnosis: "AML al 20%",
      abnormalExams: "(nessuna)",
      clinicalSignsJson: "[]",
      painNrs: null,
      roleplayScript: "Sono Sara. Mi hanno trovato tanti blasti.",
    });

    assert.match(prompt, /Reparto di degenza/);
    assert.match(prompt, /ADESSO SEI SOLO QUESTO PAZIENTE/);
    assert.match(prompt, /Sospetta leucemia mieloide acuta/);
    assert.match(prompt, /Pallida, niente sanguinamento maggiore/);
    assert.match(prompt, /midostaurin prima del FLT3/);
    assert.match(prompt, /in ansia/);
    assert.match(prompt, /ti manca il fiato/);
    assert.doesNotMatch(prompt, /NON conosci la parola/);
    const rulesEnd = prompt.indexOf("ADESSO SEI SOLO QUESTO PAZIENTE");
    assert.ok(rulesEnd > 0);
    assert.ok(prompt.indexOf("Sospetta leucemia mieloide acuta") > rulesEnd);
  });

  it("keeps refusals out of the opening script and saves them as reactions", () => {
    const prompt = buildPatientSystemPrompt({
      patientAge: "60",
      patientSex: "M",
      chiefComplaint: "Fiato corto",
      clinicalStory: "Da tre giorni ha più catarro giallo e fiato corto.",
      vitalSigns: "{}",
      patientStress: 20,
      trueDiagnosis: "nascosta",
      abnormalExams: "",
      clinicalSignsJson: "[]",
      painNrs: null,
      roleplayScript:
        "Ho più fiato corto e il catarro è giallo. Non voglio la PET. Se mi date l'ossigeno, non portatemi al 98%.",
    });

    const symptoms = prompt.slice(
      prompt.indexOf("Sintomi da raccontare subito:"),
      prompt.indexOf("Reazioni solo dopo"),
    );
    const reactions = prompt.slice(
      prompt.indexOf("Reazioni solo dopo"),
      prompt.indexOf("Situazione:"),
    );
    assert.match(symptoms, /catarro è giallo/);
    assert.doesNotMatch(symptoms, /PET/);
    assert.match(reactions, /Non voglio la PET/);
    assert.match(reactions, /ossigeno/);
    assert.match(prompt, /NON anticipare MAI al primo messaggio/);
  });
});
