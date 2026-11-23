/**
 * Voto deterministico del banco LIS v2.
 *
 *   npx tsx --test lib/simulator/laboratory-scoring.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { gradeLaboratorySession } from "@/lib/simulator/laboratory-scoring";
import {
  parseLabCaseBlueprint,
  type LabCaseBlueprint,
  type LabWorkbenchState,
} from "@/lib/simulator/laboratory-workbench";

const GHOST =
  /INVALID_CLINICAL_REPORT|diario di dimissione|esame obiettivo|stress del paziente|stress nascosto/i;

function blueprint(patch?: {
  budgetEuro?: number;
  criticalRequired?: boolean;
  analyteDisposition?: LabCaseBlueprint["analytes"][number]["expectedDisposition"];
  reason?: string;
  flag?: LabCaseBlueprint["analytes"][number]["flag"];
  reflexAction?: "MANDATORY" | "OPTIONAL" | "INAPPROPRIATE";
  reflexCost?: number;
  killers?: LabCaseBlueprint["evaluation"]["killerSwitches"];
}): LabCaseBlueprint {
  return {
    version: 2,
    accessionNumber: "LIS-24001",
    ward: "Medicina",
    priority: "REPARTO",
    slaMinutes: 30,
    clinicalOrderSummary: "Potassio su siero da medicina, senza altre richieste.",
    patientDemographics: { age: 68, sex: "F", wardContext: "Letto 12, medicina" },
    budgetEuro: patch?.budgetEuro ?? 40,
    analytes: [
      {
        id: "k",
        name: "Potassio",
        value: "6.1",
        unit: "mmol/L",
        refRange: "3.5-5.1",
        flag: patch?.flag ?? "HIGH",
        instrumentFlags: ["HEM+"],
        expectedDisposition: patch?.analyteDisposition ?? "VALIDATE",
        ...(patch?.reason ? { expectedReasonCode: patch.reason } : {}),
      },
    ],
    investigations: {
      sampleInspection: {
        tubeType: "Siero",
        fillLevel: "ADEQUATE",
        clotCheck: "ABSENT",
        labelIntegrity: "INTACT",
        collectionToReceiptMin: 18,
        visualNote: "Siero rosato dopo centrifugazione.",
        anomalyDetected: false,
      },
      hilIndices: {
        hemolysisIndex: 0,
        icterusIndex: 0,
        lipemiaIndex: 0,
        wavelengthNote: "Nessun picco oltre soglia.",
        affectedAnalytes: [],
      },
      qcStatus: {
        analyzerLine: "Chimica-1",
        status: "IN_CONTROL",
        summary: "Westgard in controllo.",
      },
    },
    reflexCatalog: [
      {
        id: "reflex-1",
        name: "Reflex di conferma",
        costEuro: patch?.reflexCost ?? 8,
        category: "Chimica",
        expectedAction: patch?.reflexAction ?? "MANDATORY",
        resultSummary: "Conferma coerente con il ticket.",
        clinicalRationale: "Serve a chiudere il quesito del ticket.",
      },
    ],
    criticalValuePolicy: {
      required: patch?.criticalRequired ?? true,
      mustUseSynchronousPhone: true,
      requiresReadBack: true,
      targetRecipient: "REPARTO",
      slaMinutes: 15,
      rationale: "Il critico si chiude solo con telefonata e read-back.",
    },
    personas: {
      tslb: {
        briefing: "Può ispezionare la provetta, leggere HIL e QC, non firmare.",
        allowedChecks: ["provetta", "HIL", "QC"],
        limits: "Non valida e non chiama il reparto al posto del medico.",
      },
      clinician: {
        hiddenHistory: "Nessun integratore dichiarato allo sportello.",
        medicationsAndSupplements: [],
        pressures: ["Chiede il numero subito, senza un secondo prelievo."],
        readBackScript: "Rileggo nome, valore e unità.",
      },
    },
    evaluation: {
      requiredInvestigations: ["sampleInspection", "hilIndices", "qcStatus"],
      expectedValidationNoteConcepts: ["potassio", "read-back"],
      killerSwitches: patch?.killers ?? [],
    },
  };
}

function state(patch?: Partial<LabWorkbenchState>): LabWorkbenchState {
  return {
    version: 2,
    unlockedInvestigations: [
      { id: "sampleInspection", unlockedAtIso: "2026-11-23T10:00:00.000Z" },
      { id: "hilIndices", unlockedAtIso: "2026-11-23T10:01:00.000Z" },
      { id: "qcStatus", unlockedAtIso: "2026-11-23T10:02:00.000Z" },
    ],
    requestedReflexIds: [
      { id: "reflex-1", orderedAtIso: "2026-11-23T10:03:00.000Z", costEuro: 8 },
    ],
    reflexSpendEuro: 8,
    dispositions: {
      k: { action: "VALIDATE", decidedAtIso: "2026-11-23T10:04:00.000Z" },
    },
    criticalNotification: {
      sent: true,
      channel: "PHONE",
      recipientName: "Dr. Neri",
      readBackConfirmed: true,
      notifiedAtIso: "2026-11-23T10:05:00.000Z",
      elapsedMinutes: 8,
    },
    validationNote: "Potassio refertato dopo verifica. Read-back eseguito con il reparto.",
    signedAtIso: "2026-11-23T10:06:00.000Z",
    interprofessionalLog: [
      { role: "user", content: "Confermo il valore al telefono.", createdAtIso: "2026-11-23T10:05:00.000Z" },
      { role: "clinician", content: "Rileggo 6.1 mmol/L.", createdAtIso: "2026-11-23T10:05:30.000Z" },
    ],
    ...patch,
  };
}

function assertNoGhostPenalties(grade: ReturnType<typeof gradeLaboratorySession>) {
  assert.deepEqual(grade.clinicalPenaltiesApplied, {
    invalidClinicalReport: false,
    dischargeDiaryMalus: false,
    physicalExamMalus: false,
    hiddenStressMalus: false,
  });
  assert.doesNotMatch(JSON.stringify(grade.waterfall), GHOST);
}

describe("gradeLaboratorySession", () => {
  it("scores a complete bench at least 28/30 without ward penalties", () => {
    const grade = gradeLaboratorySession({ blueprint: blueprint(), state: state() });
    assert.ok(grade.totalTrentesimi >= 28);
    assert.equal(grade.killerSwitchApplied, false);
    assert.equal(grade.scores.clinical, 100);
    assert.equal(grade.scores.legal, 100);
    assert.equal(grade.scores.empathy, 100);
    assertNoGhostPenalties(grade);
  });

  it("caps a validated hemolyzed potassium at the killer switch", () => {
    const grade = gradeLaboratorySession({
      blueprint: blueprint({
        criticalRequired: false,
        analyteDisposition: "SUPPRESS",
        reason: "EMOLISI",
        flag: "CRITICAL_HIGH",
        killers: [
          {
            id: "hemolysis-k",
            label: "Potassio validato su siero emolizzato",
            trigger: {
              kind: "VALIDATE_UNRELIABLE_ANALYTE",
              analyteId: "k",
              whenReasonCodes: ["EMOLISI"],
            },
            maxScoreCap: 17,
          },
        ],
      }),
      state: state({
        criticalNotification: undefined,
        dispositions: {
          k: { action: "VALIDATE", decidedAtIso: "2026-11-23T10:04:00.000Z" },
        },
      }),
    });
    assert.ok(grade.rawTrentesimi > 17);
    assert.equal(grade.totalTrentesimi, 17);
    assert.equal(grade.killerSwitchApplied, true);
    assert.ok(grade.waterfall.legal.some((step) => step.kind === "cap" && /17\/30/.test(step.detail)));
    assertNoGhostPenalties(grade);
  });

  it("records a legal penalty when a real critical value goes out by fax without read-back", () => {
    const grade = gradeLaboratorySession({
      blueprint: blueprint(),
      state: state({
        criticalNotification: {
          sent: true,
          channel: "FAX",
          readBackConfirmed: false,
          elapsedMinutes: 4,
        },
      }),
    });
    assert.equal(grade.scores.legal, 25);
    assert.equal(grade.killerSwitchApplied, false);
    const penalties = grade.waterfall.legal.filter((step) => step.kind === "penalty");
    assert.ok(penalties.some((step) => /FAX/.test(step.detail)));
    assert.ok(penalties.some((step) => /read-back/i.test(step.detail)));
    assert.ok(grade.totalTrentesimi < 30);
    assertNoGhostPenalties(grade);
  });

  it("penalises the economy pillar when inappropriate reflexes overrun the budget", () => {
    const grade = gradeLaboratorySession({
      blueprint: blueprint({
        reflexAction: "INAPPROPRIATE",
        reflexCost: 80,
        criticalRequired: true,
      }),
      state: state({
        requestedReflexIds: [
          { id: "reflex-1", orderedAtIso: "2026-11-23T10:03:00.000Z", costEuro: 80 },
        ],
        reflexSpendEuro: 80,
      }),
    });
    assert.equal(grade.scores.economy, 15);
    assert.equal(grade.inappropriateSpendEuro, 80);
    assert.ok(
      grade.waterfall.economy.some(
        (step) => step.kind === "penalty" && step.label === "Sforamento budget SSN",
      ),
    );
    assertNoGhostPenalties(grade);
  });

  it("does not treat a v1 laboratory case as a workbench blueprint", () => {
    assert.equal(
      parseLabCaseBlueprint({
        id: "LABO-001",
        specialty: "medicina_laboratorio",
        nodes: [{ id: "d1", type: "decision" }],
      }),
      null,
    );
  });
});
