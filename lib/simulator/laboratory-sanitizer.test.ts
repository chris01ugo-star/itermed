/**
 * Il client del banco riceve solo il ticket, mai il gold standard.
 *
 *   npx tsx --test lib/simulator/laboratory-sanitizer.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  emptyLabWorkbenchState,
  sanitizeLabBlueprintForClient,
  type LabCaseBlueprint,
  type LabWorkbenchState,
} from "@/lib/simulator/laboratory-workbench";

const FORBIDDEN = [
  "expectedDisposition",
  "expectedReasonCode",
  "expectedAction",
  "clinicalRationale",
  "criticalValuePolicy",
  "personas",
  "evaluation",
  "killerSwitches",
  "hiddenHistory",
  "GOLD_RATIONALE",
  "HIDDEN_PERSONA",
  "KILLER_LABEL",
];

function keysOf(value: unknown, found = new Set<string>()): Set<string> {
  if (!value || typeof value !== "object") return found;
  if (Array.isArray(value)) {
    value.forEach((item) => keysOf(item, found));
    return found;
  }
  for (const [key, nested] of Object.entries(value)) {
    found.add(key);
    keysOf(nested, found);
  }
  return found;
}

function blueprint(): LabCaseBlueprint {
  return {
    version: 2,
    accessionNumber: "ACC-24088",
    ward: "Medicina",
    priority: "REPARTO",
    slaMinutes: 30,
    clinicalOrderSummary: "Potassio su siero.",
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
        instrumentFlags: ["HEM+"],
        deltaCheck: {
          previousValue: "4.2",
          previousDate: "2026-11-20",
          deltaPercent: 61,
          deltaFlag: true,
        },
        expectedDisposition: "SUPPRESS",
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
        visualNote: "Siero limpido.",
        anomalyDetected: false,
      },
      hilIndices: {
        hemolysisIndex: 80,
        icterusIndex: 1,
        lipemiaIndex: 0,
        wavelengthNote: "Picco a 570 nm.",
        affectedAnalytes: ["k"],
      },
      qcStatus: {
        analyzerLine: "Chimica-2",
        status: "IN_CONTROL",
        summary: "In controllo.",
        leveyJennings: {
          analyteName: "Potassio",
          unit: "mmol/L",
          mean: 4.2,
          sd: 0.08,
          lotNumber: "LOT-K-88",
          points: [
            { runLabel: "S1", value: 4.22 },
            { runLabel: "S2", value: 4.16 },
            { runLabel: "S3", value: 4.24 },
            { runLabel: "S4", value: 4.18 },
            { runLabel: "S5", value: 4.26 },
            { runLabel: "S6", value: 4.15 },
            { runLabel: "S7", value: 4.21 },
            { runLabel: "S8", value: 4.17 },
          ],
        },
      },
      morphologyOrTrace: {
        kind: "SMEAR",
        title: "Striscio",
        findings: "Nessuno schistocita.",
        visual: {
          type: "MICROSCOPY",
          specimen: "PERIPHERAL_SMEAR",
          magnification: "100x immersione",
          stain: "May-Grünwald-Giemsa",
          elements: [{ kind: "RBC_NORMAL", count: 4 }],
          caption: "Striscio periferico, May-Grünwald-Giemsa.",
        },
      },
    },
    reflexCatalog: [
      {
        id: "hapt",
        name: "Aptoglobina",
        costEuro: 11.2,
        category: "Chimica",
        expectedAction: "INAPPROPRIATE",
        resultSummary: "Aptoglobina nella norma.",
        clinicalRationale: "GOLD_RATIONALE",
      },
    ],
    criticalValuePolicy: {
      required: true,
      mustUseSynchronousPhone: true,
      requiresReadBack: true,
      targetRecipient: "REPARTO",
      slaMinutes: 15,
      rationale: "Telefonata.",
    },
    personas: {
      tslb: {
        briefing: "Il tecnico guarda la provetta e non firma.",
        allowedChecks: ["provetta"],
        limits: "Non chiama il reparto.",
      },
      clinician: {
        hiddenHistory: "HIDDEN_PERSONA",
        medicationsAndSupplements: [],
        pressures: [],
        readBackScript: "Rileggo il valore.",
      },
    },
    evaluation: {
      requiredInvestigations: ["hilIndices"],
      expectedValidationNoteConcepts: ["emolisi"],
      killerSwitches: [
        {
          id: "secret",
          label: "KILLER_LABEL",
          trigger: { kind: "OMIT_SYNCHRONOUS_CRITICAL_CALL" },
          maxScoreCap: 17,
        },
      ],
    },
  };
}

function state(patch?: Partial<LabWorkbenchState>): LabWorkbenchState {
  return { ...emptyLabWorkbenchState(), ...patch };
}

describe("sanitizeLabBlueprintForClient", () => {
  it("hides gold, locked evidence, history and reflex results", () => {
    const client = sanitizeLabBlueprintForClient(blueprint(), state());
    const serialized = JSON.stringify(client);
    const keys = keysOf(client);
    for (const key of FORBIDDEN) {
      assert.equal(keys.has(key), false, key);
      assert.equal(serialized.includes(key), false, key);
    }
    assert.equal(client.investigations.sampleInspection.unlocked, false);
    assert.equal("tubeType" in client.investigations.sampleInspection, false);
    assert.equal(client.investigations.hilIndices.unlocked, false);
    assert.equal(client.investigations.morphologyOrTrace.available, true);
    assert.equal(client.investigations.morphologyOrTrace.unlocked, false);
    assert.equal(serialized.includes("LOT-K-88"), false);
    assert.equal(serialized.includes("May-Grünwald-Giemsa"), false);
    assert.equal("leveyJennings" in client.investigations.qcStatus, false);
    assert.equal("visual" in client.investigations.morphologyOrTrace, false);
    assert.equal(client.analytes[0]?.deltaCheck.hasHistory, true);
    assert.equal("previousValue" in client.analytes[0]!.deltaCheck, false);
    assert.equal(client.reflexCatalog[0]?.ordered, false);
    assert.equal(client.reflexCatalog[0]?.resultSummary, undefined);
    assert.equal(client.accessionNumber, "ACC-24088");
  });

  it("reveals only the evidence and reflex the bench has opened", () => {
    const client = sanitizeLabBlueprintForClient(
      blueprint(),
      state({
        unlockedInvestigations: [
          { id: "sampleInspection", unlockedAtIso: "2026-11-23T10:00:00.000Z" },
          { id: "deltaCheck", unlockedAtIso: "2026-11-23T10:01:00.000Z" },
        ],
        requestedReflexIds: [{ id: "hapt", orderedAtIso: "2026-11-23T10:02:00.000Z", costEuro: 11.2 }],
      }),
    );
    assert.equal(client.investigations.sampleInspection.unlocked, true);
    if (client.investigations.sampleInspection.unlocked) {
      assert.equal(client.investigations.sampleInspection.tubeType, "Siero");
    }
    assert.equal(client.investigations.hilIndices.unlocked, false);
    assert.equal("hemolysisIndex" in client.investigations.hilIndices, false);
    assert.deepEqual(client.analytes[0]?.deltaCheck, {
      hasHistory: true,
      previousValue: "4.2",
      previousDate: "2026-11-20",
      deltaPercent: 61,
      deltaFlag: true,
    });
    assert.equal(client.reflexCatalog[0]?.resultSummary, "Aptoglobina nella norma.");
    assert.equal(JSON.stringify(client).includes("GOLD_RATIONALE"), false);
    assert.equal(JSON.stringify(client).includes("expectedDisposition"), false);
  });

  it("rivela carta di controllo e tracciato solo dopo lo sblocco, senza chiavi di soluzione", () => {
    const source = blueprint();
    const visual = source.investigations.morphologyOrTrace?.visual;
    assert.ok(visual);
    Object.assign(visual, { expectedDisposition: "VALIDATE", killerSwitches: [] });
    const client = sanitizeLabBlueprintForClient(
      source,
      state({
        unlockedInvestigations: [
          { id: "qcStatus", unlockedAtIso: "2026-11-23T10:00:00.000Z" },
          { id: "morphologyOrTrace", unlockedAtIso: "2026-11-23T10:01:00.000Z" },
        ],
      }),
    );
    assert.equal(client.investigations.qcStatus.unlocked, true);
    if (client.investigations.qcStatus.unlocked) {
      assert.equal(client.investigations.qcStatus.leveyJennings?.lotNumber, "LOT-K-88");
    }
    assert.equal(client.investigations.morphologyOrTrace.unlocked, true);
    if (client.investigations.morphologyOrTrace.unlocked && client.investigations.morphologyOrTrace.visual) {
      assert.equal(client.investigations.morphologyOrTrace.visual.type, "MICROSCOPY");
    }
    const serialized = JSON.stringify(client);
    assert.equal(serialized.includes("expectedDisposition"), false);
    assert.equal(serialized.includes("killerSwitches"), false);
    assert.equal(serialized.includes("VALIDATE"), false);
  });

  it("marks a missing trace as unavailable", () => {
    const source = blueprint();
    delete source.investigations.morphologyOrTrace;
    const client = sanitizeLabBlueprintForClient(source, state());
    assert.deepEqual(client.investigations.morphologyOrTrace, { available: false, unlocked: false });
  });
});
