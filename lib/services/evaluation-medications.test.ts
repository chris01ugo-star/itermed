/**
 * Appropriatezza terapeutica nel pilastro clinico.
 *
 *   npx tsx --test lib/services/evaluation-medications.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeClinicalAccuracyScore } from "@/lib/services/evaluation-scoring";
import {
  blendClinicalScoreWithTherapy,
  evaluateTherapyAppropriateness,
  THERAPY_SHARE_OF_CLINICAL,
} from "@/lib/services/evaluation-medications";
import type { SessionPrescription } from "@/lib/simulator/prescription-trace";

function rx(
  partial: Pick<SessionPrescription, "id" | "commercialName" | "activeIngredient"> & {
    posology?: string;
  },
): SessionPrescription {
  return {
    dosageForm: "fiala",
    price: 1,
    route: "endovenosa",
    category: "Cardiologia",
    posology: "secondo protocollo",
    trace: "",
    prescribedAt: "2026-10-08T00:00:00.000Z",
    ...partial,
  };
}

describe("evaluateTherapyAppropriateness", () => {
  it("scores first-line drugs from legacy goldTherapy and ignores non-drug steps", () => {
    const result = evaluateTherapyAppropriateness({
      baselineExamFindings: {
        goldTherapy: {
          immediate: [
            "posizione_seduta",
            "O2_CPAP_Boussignac_o_NIMV_PEEP_5_10",
            "furosemide_ev_40_80_mg_entro_30_min",
            "nitroglicerina_ev_se_PAS_gt_110",
          ],
        },
      },
      prescriptions: [rx({ id: "lasix", commercialName: "Lasix", activeIngredient: "Furosemide" })],
    });

    assert.equal(result.applicable, true);
    assert.equal(result.indicatedExpected, 2);
    assert.equal(result.indicatedMet, 1);
    assert.equal(result.omitted.length, 1);
    assert.match(result.omitted[0]!.label, /nitroglicerina/i);
    assert.equal(result.score, 50);
    assert.equal(result.weight, THERAPY_SHARE_OF_CLINICAL);
  });

  it("penalises a non-lethal contraindicated drug without treating it as indicated", () => {
    const result = evaluateTherapyAppropriateness({
      baselineExamFindings: {
        goldTherapy: {
          immediate: ["atropina_1mg_ev_tentabile"],
          contraindicated: ["beta_bloccanti", "verapamil", "diltiazem_bradicardizzante"],
        },
      },
      prescriptions: [
        rx({ id: "atropina", commercialName: "Atropina", activeIngredient: "Atropina" }),
        rx({ id: "isoptin", commercialName: "Isoptin", activeIngredient: "Verapamil" }),
      ],
    });

    assert.equal(result.indicatedMet, 1);
    assert.equal(result.contraindicated.length, 1);
    assert.match(result.contraindicated[0]!.matchedPrescription ?? "", /verapamil/i);
    assert.equal(result.score, 60);
  });

  it("accepts any drug in a rate-control group and a DOAC for anticoagulation", () => {
    const result = evaluateTherapyAppropriateness({
      baselineExamFindings: {
        goldTherapy: {
          rateControl: ["metoprololo iv", "esmololo iv", "diltiazem"],
          anticoagulation: "DOAC (Nota AIFA 95)",
        },
      },
      prescriptions: [
        rx({ id: "seloken", commercialName: "Seloken", activeIngredient: "Metoprololo" }),
        rx({ id: "eliquis", commercialName: "Eliquis", activeIngredient: "Apixaban" }),
      ],
    });

    assert.equal(result.indicatedExpected, 2);
    assert.equal(result.indicatedMet, 2);
    assert.equal(result.score, 100);
  });

  it("turns a stop-the-drug step into a contraindication, not a required prescription", () => {
    const result = evaluateTherapyAppropriateness({
      baselineExamFindings: {
        goldTherapy: {
          immediate: ["sospensione_digossina_ramipril_spironolattone", "insulina_piu_glucosata_ev"],
        },
      },
      prescriptions: [rx({ id: "lanoxin", commercialName: "Lanoxin", activeIngredient: "Digossina" })],
    });

    assert.equal(result.correct.length, 0);
    assert.equal(result.contraindicated.length, 1);
    assert.ok(result.omitted.some((item) => /insulina/i.test(item.label)));
  });

  it("penalises explicit over-treatment from therapyMatrix", () => {
    const result = evaluateTherapyAppropriateness({
      baselineExamFindings: {
        therapyMatrix: {
          indicated: [
            { id: "paracetamolo", label: "Paracetamolo", aliases: ["paracetamolo"] },
          ],
          inappropriate: [
            { id: "amoxicillina", label: "Antibiotico non indicato", aliases: ["amoxicillina", "augmentin"] },
          ],
          contraindicated: [],
        },
      },
      prescriptions: [
        rx({ id: "tachipirina", commercialName: "Tachipirina", activeIngredient: "Paracetamolo" }),
        rx({ id: "augmentin", commercialName: "Augmentin", activeIngredient: "Amoxicillina/Acido clavulanico" }),
      ],
    });

    assert.equal(result.indicatedMet, 1);
    assert.equal(result.inappropriate.length, 1);
    assert.equal(result.score, 75);
  });

  it("leaves the clinical score unchanged when the case has no therapy matrix", () => {
    const result = evaluateTherapyAppropriateness({
      baselineExamFindings: { examBudgetEuro: 400 },
      prescriptions: [rx({ id: "lasix", commercialName: "Lasix", activeIngredient: "Furosemide" })],
    });
    assert.equal(result.applicable, false);
    assert.equal(blendClinicalScoreWithTherapy(80, result.score, { applicable: false }), 80);
  });

  it("blends therapy as 20% of the clinical pillar and does not raise an iatrogenic zero", () => {
    assert.equal(blendClinicalScoreWithTherapy(80, 50), 74);
    assert.equal(
      blendClinicalScoreWithTherapy(0, 100, { iatrogenicCritical: true }),
      0,
    );
  });

  it("gives full credit when the posology is one of validDosages", () => {
    const result = evaluateTherapyAppropriateness({
      baselineExamFindings: {
        therapyMatrix: {
          indicated: [
            {
              id: "furosemide",
              label: "Furosemide",
              aliases: ["furosemide", "lasix"],
              validDosages: ["1 fiala EV", "Dose singola (In acuto)"],
            },
          ],
        },
      },
      prescriptions: [
        rx({
          id: "lasix",
          commercialName: "Lasix",
          activeIngredient: "Furosemide",
          posology: "1 fiala EV",
        }),
      ],
    });

    assert.equal(result.indicatedMet, 1);
    assert.equal(result.wrongDosage.length, 0);
    assert.equal(result.score, 100);
  });

  it("counts a right drug with the wrong dropdown posology as half a match", () => {
    const result = evaluateTherapyAppropriateness({
      baselineExamFindings: {
        therapyMatrix: {
          indicated: [
            {
              id: "furosemide",
              label: "Furosemide",
              aliases: ["furosemide", "lasix"],
              validDosages: ["1 fiala EV"],
            },
            {
              id: "nitroglicerina",
              label: "Nitroglicerina",
              aliases: ["nitroglicerina"],
              validDosages: ["In infusione continua"],
            },
          ],
        },
      },
      prescriptions: [
        rx({
          id: "lasix",
          commercialName: "Lasix",
          activeIngredient: "Furosemide",
          posology: "1 cpr / die",
        }),
        rx({
          id: "nitro",
          commercialName: "Nitroglicerina",
          activeIngredient: "Nitroglicerina",
          posology: "In infusione continua",
        }),
      ],
    });

    assert.equal(result.correct.length, 1);
    assert.equal(result.wrongDosage.length, 1);
    assert.equal(result.wrongDosage[0]?.prescribedPosology, "1 cpr / die");
    assert.deepEqual(result.wrongDosage[0]?.validDosages, ["1 fiala EV"]);
    assert.equal(result.omitted.length, 0);
    assert.equal(result.score, 75);
  });

  it("does not judge posology when validDosages is omitted", () => {
    const result = evaluateTherapyAppropriateness({
      baselineExamFindings: {
        therapyMatrix: {
          indicated: [{ id: "furosemide", label: "Furosemide", aliases: ["furosemide"] }],
        },
      },
      prescriptions: [
        rx({
          id: "lasix",
          commercialName: "Lasix",
          activeIngredient: "Furosemide",
          posology: "Al bisogno",
        }),
      ],
    });

    assert.equal(result.wrongDosage.length, 0);
    assert.equal(result.score, 100);
  });

  it("feeds the therapeutic score into computeClinicalAccuracyScore", () => {
    const scored = computeClinicalAccuracyScore([], {
      baselineExamFindings: {
        therapyMatrix: {
          indicated: [{ id: "furosemide", label: "Furosemide", aliases: ["furosemide", "lasix"] }],
        },
      },
      prescribedMedications: [rx({ id: "lasix", commercialName: "Lasix", activeIngredient: "Furosemide" })],
    });

    assert.equal(scored.breakdown.therapy?.applicable, true);
    assert.equal(scored.breakdown.therapy?.score, 100);
    assert.equal(scored.score, 20);
  });
});
