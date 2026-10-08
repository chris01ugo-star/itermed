/**
 * Controllo allergie trasversale sul ricettario.
 *
 *   npx tsx --test lib/services/evaluation-allergies.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeClinicalAccuracyScore } from "@/lib/services/evaluation-scoring";
import {
  detectAllergyFatalPrescriptions,
  extractPatientAllergies,
} from "@/lib/services/evaluation-allergies";
import type { SessionPrescription } from "@/lib/simulator/prescription-trace";

function rx(partial: Pick<SessionPrescription, "id" | "commercialName" | "activeIngredient">): SessionPrescription {
  return {
    ...partial,
    dosageForm: "fiala",
    price: 1,
    route: "endovenosa",
    category: "Urgenza",
    posology: "1 fiala EV",
    trace: "",
    prescribedAt: "2026-10-08T00:00:00.000Z",
  };
}

describe("allergy killer check", () => {
  it("reads allergies from patient.allergies and ignores a negated sentence", () => {
    assert.deepEqual(
      extractPatientAllergies({
        patient: { allergies: ["FANS", "Nessuna allergia nota"] },
      }),
      ["FANS"],
    );
  });

  it("flags ketorolac when the patient is allergic to FANS", () => {
    const hits = detectAllergyFatalPrescriptions({
      baselineExamFindings: { patient: { allergies: ["FANS"] } },
      prescriptions: [rx({ id: "toradol", commercialName: "Toradol", activeIngredient: "Ketorolac" })],
    });
    assert.equal(hits.length, 1);
    assert.equal(
      hits[0]?.description,
      "Reazione allergica iatrogena grave: somministrato Toradol (Ketorolac) a paziente con allergia nota a FANS",
    );
  });

  it("flags amoxicillin for penicillins and ceftriaxone for cephalosporins", () => {
    const penicillin = detectAllergyFatalPrescriptions({
      allergies: ["Penicilline"],
      prescriptions: [
        rx({
          id: "augmentin",
          commercialName: "Augmentin",
          activeIngredient: "Amoxicillina/Acido clavulanico",
        }),
      ],
    });
    const ceph = detectAllergyFatalPrescriptions({
      allergies: ["Cefalosporine"],
      prescriptions: [rx({ id: "rocefin", commercialName: "Rocefin", activeIngredient: "Ceftriaxone" })],
    });
    assert.equal(penicillin.length, 1);
    assert.equal(ceph.length, 1);
  });

  it("does not flag an unrelated drug", () => {
    const hits = detectAllergyFatalPrescriptions({
      baselineExamFindings: { allergies: ["FANS"] },
      prescriptions: [rx({ id: "lasix", commercialName: "Lasix", activeIngredient: "Furosemide" })],
    });
    assert.equal(hits.length, 0);
  });

  it("zeros clinical accuracy before therapy credit can raise it", () => {
    const scored = computeClinicalAccuracyScore([], {
      baselineExamFindings: {
        patient: { allergies: ["FANS"] },
        therapyMatrix: {
          indicated: [
            {
              id: "ibuprofene",
              label: "Ibuprofene",
              aliases: ["ibuprofene"],
              validDosages: ["1 fiala EV"],
            },
          ],
        },
      },
      prescribedMedications: [
        rx({
          id: "brufen",
          commercialName: "Brufen",
          activeIngredient: "Ibuprofene",
        }),
      ],
    });

    assert.equal(scored.score, 0);
    assert.equal(scored.breakdown.iatrogenicCritical, true);
    assert.match(scored.breakdown.iatrogenicEvents?.[0]?.name ?? "", /Reazione allergica iatrogena grave/);
    assert.equal(scored.breakdown.therapy?.score, 100);
  });
});
