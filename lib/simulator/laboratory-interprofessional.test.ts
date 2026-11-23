/**
 * Linea interna del banco LIS: thread separati, prompt e read-back.
 *
 *   npx tsx --test lib/simulator/laboratory-interprofessional.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildLabInterprofessionalSystemPrompt,
  detectReadBackSignal,
  formatLabInterprofessionalLog,
} from "@/lib/simulator/laboratory-interprofessional";
import {
  filterLabConversationByTarget,
  type LabCaseBlueprint,
  type LabInterprofessionalEntry,
  type LabWorkbenchState,
} from "@/lib/simulator/laboratory-workbench";

const ANTI_SPOILER = "Non citare codici interni del caso";

function at(index: number): string {
  return `2026-11-23T10:${String(index).padStart(2, "0")}:00.000Z`;
}

function blueprint(): LabCaseBlueprint {
  return {
    version: 2,
    accessionNumber: "LIS-24088",
    ward: "Medicina",
    priority: "REPARTO",
    slaMinutes: 30,
    clinicalOrderSummary: "Potassio su siero da medicina.",
    patientDemographics: { age: 71, sex: "M", wardContext: "Letto 4" },
    budgetEuro: 40,
    analytes: [
      {
        id: "k",
        name: "Potassio",
        value: "6.8",
        unit: "mmol/L",
        refRange: "3.5-5.1",
        flag: "CRITICAL_HIGH",
        instrumentFlags: ["HEM-"],
        expectedDisposition: "VALIDATE",
        expectedReasonCode: "EMOLISI",
      },
    ],
    investigations: {
      sampleInspection: {
        tubeType: "Siero",
        fillLevel: "ADEQUATE",
        clotCheck: "ABSENT",
        labelIntegrity: "INTACT",
        collectionToReceiptMin: 12,
        visualNote: "SIERO_ROSATO_VISIBILE",
        anomalyDetected: false,
      },
      hilIndices: {
        hemolysisIndex: 12,
        icterusIndex: 0,
        lipemiaIndex: 0,
        wavelengthNote: "Picco di emolisi sopra soglia.",
        affectedAnalytes: ["k"],
      },
      qcStatus: {
        analyzerLine: "Chimica-2",
        status: "IN_CONTROL",
        summary: "Westgard in controllo.",
      },
    },
    reflexCatalog: [],
    criticalValuePolicy: {
      required: true,
      mustUseSynchronousPhone: true,
      requiresReadBack: true,
      targetRecipient: "REPARTO",
      slaMinutes: 15,
      rationale: "Il critico si chiude al telefono.",
    },
    personas: {
      tslb: {
        briefing: "BRIEFING_TSLB_COAGULO_CITRATO",
        allowedChecks: ["provetta", "HIL"],
        limits: "Non firma il referto.",
      },
      clinician: {
        hiddenHistory: "ANAMNESI_NASCOSTA_BIOTINA_10MG",
        medicationsAndSupplements: ["biotina 10 mg"],
        pressures: ["PRESSIONE_SALA_OPERATORIA"],
        readBackScript: "SCRIPT_READBACK_6_8",
      },
    },
    evaluation: {
      requiredInvestigations: ["hilIndices"],
      expectedValidationNoteConcepts: ["CONCETTO_GOLD_SEGRETO"],
      killerSwitches: [
        {
          id: "secret-killer",
          label: "KILLER_SEGRETO_NON_DIRE",
          trigger: { kind: "OMIT_SYNCHRONOUS_CRITICAL_CALL" },
          maxScoreCap: 17,
        },
      ],
    },
  };
}

function emptyState(): LabWorkbenchState {
  return {
    version: 2,
    unlockedInvestigations: [],
    requestedReflexIds: [],
    reflexSpendEuro: 0,
    dispositions: {},
    validationNote: "",
    interprofessionalLog: [],
  };
}

describe("filterLabConversationByTarget", () => {
  const log: LabInterprofessionalEntry[] = [
    { role: "user", target: "tslb", content: "Il citrato è sotto il segno?", createdAtIso: at(1) },
    { role: "tslb", content: "Riempimento sotto il segno, coagulo assente.", createdAtIso: at(2) },
    { role: "user", target: "clinician", content: "Il paziente assume biotina?", createdAtIso: at(3) },
    { role: "clinician", content: "Sì, integratore da 10 mg.", createdAtIso: at(4) },
    { role: "user", content: "Rileggo il valore con lei.", createdAtIso: at(5) },
  ];

  it("keeps the bench thread out of the clinician thread", () => {
    const tslb = filterLabConversationByTarget(log, "tslb");
    const clinician = filterLabConversationByTarget(log, "clinician");
    assert.deepEqual(
      tslb.map((row) => row.content),
      ["Il citrato è sotto il segno?", "Riempimento sotto il segno, coagulo assente."],
    );
    assert.deepEqual(
      clinician.map((row) => row.content),
      ["Il paziente assume biotina?", "Sì, integratore da 10 mg.", "Rileggo il valore con lei."],
    );
    assert.equal(tslb.some((row) => /biotina/i.test(row.content)), false);
    assert.equal(clinician.some((row) => /citrato/i.test(row.content)), false);
  });

  it("keeps only the most recent turns", () => {
    const longThread: LabInterprofessionalEntry[] = Array.from({ length: 14 }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "tslb",
      target: "tslb" as const,
      content: `turno-${index}`,
      createdAtIso: at(index),
    }));
    const window = filterLabConversationByTarget(longThread, "tslb", 12);
    assert.equal(window.length, 12);
    assert.equal(window[0]?.content, "turno-2");
    assert.equal(window.at(-1)?.content, "turno-13");
    assert.equal(filterLabConversationByTarget(longThread, "clinician").length, 0);
    const defaultWindow = filterLabConversationByTarget(
      longThread.slice(0, 13),
      "tslb",
    );
    assert.equal(defaultWindow.length, 12);
  });
});

describe("buildLabInterprofessionalSystemPrompt", () => {
  const state = emptyState();

  it("puts the stable ticket first and separates the two briefings", () => {
    const tslb = buildLabInterprofessionalSystemPrompt({ blueprint: blueprint(), state, target: "tslb" });
    const clinician = buildLabInterprofessionalSystemPrompt({
      blueprint: blueprint(),
      state,
      target: "clinician",
    });

    assert.ok(tslb.startsWith("BANCO LIS — DATI STABILI DEL CASO"));
    assert.ok(tslb.indexOf("BANCO LIS") < tslb.indexOf("RUOLO:"));
    assert.ok(tslb.indexOf("RUOLO:") < tslb.indexOf("STATO SESSIONE"));
    assert.match(tslb, /BRIEFING_TSLB_COAGULO_CITRATO/);
    assert.match(tslb, /SIERO_ROSATO_VISIBILE/);
    assert.doesNotMatch(tslb, /ANAMNESI_NASCOSTA_BIOTINA_10MG/);
    assert.doesNotMatch(tslb, /SCRIPT_READBACK_6_8/);

    assert.match(clinician, /ANAMNESI_NASCOSTA_BIOTINA_10MG/);
    assert.match(clinician, /PRESSIONE_SALA_OPERATORIA/);
    assert.match(clinician, /SCRIPT_READBACK_6_8/);
    assert.match(clinician, /read-back/i);
    assert.doesNotMatch(clinician, /BRIEFING_TSLB_COAGULO_CITRATO/);
    assert.doesNotMatch(clinician, /SIERO_ROSATO_VISIBILE/);

    for (const prompt of [tslb, clinician]) {
      assert.match(prompt, new RegExp(ANTI_SPOILER));
      assert.match(prompt, /SIBioC/);
      assert.match(prompt, /validare, sopprimere o notificare/);
      assert.doesNotMatch(prompt, /KILLER_SEGRETO_NON_DIRE/);
      assert.doesNotMatch(prompt, /CONCETTO_GOLD_SEGRETO/);
      assert.doesNotMatch(prompt, /expectedDisposition/);
    }
  });
});

describe("detectReadBackSignal", () => {
  const caseBlueprint = blueprint();

  it("accepts an explicit critical-value read-back and ignores a generic reply", () => {
    assert.equal(
      detectReadBackSignal("Rileggo potassio 6,8 mmol/L e avvio il trattamento.", caseBlueprint),
      true,
    );
    assert.equal(detectReadBackSignal("Va bene, ci sentiamo dopo il giro.", caseBlueprint), false);
    assert.equal(detectReadBackSignal("Rileggo, grazie.", caseBlueprint), false);
    assert.equal(detectReadBackSignal("Il potassio è 6.8, grazie.", caseBlueprint), false);
  });
});

describe("formatLabInterprofessionalLog", () => {
  it("labels who the pathologist was speaking to", () => {
    const text = formatLabInterprofessionalLog([
      { role: "user", target: "tslb", content: "Guardi il coagulo.", createdAtIso: at(1) },
      { role: "tslb", content: "Coagulo assente.", createdAtIso: at(2) },
      { role: "user", target: "clinician", content: "Le detto il critico.", createdAtIso: at(3) },
      { role: "clinician", content: "Rileggo 6.8.", createdAtIso: at(4) },
    ]);
    assert.match(text, /\[Patologo → TSLB\] Guardi il coagulo\./);
    assert.match(text, /\[TSLB\] Coagulo assente\./);
    assert.match(text, /\[Patologo → Medico richiedente\] Le detto il critico\./);
    assert.match(text, /\[Medico richiedente\] Rileggo 6\.8\./);
  });
});
