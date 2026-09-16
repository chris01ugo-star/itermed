/**
 *   npx tsx --test lib/clinical/clinical-signs.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clinicalSignExamId,
  formatClinicalSignFinding,
  matchClinicalSign,
  parseClinicalSigns,
  serializeClinicalSignsJson,
} from "@/lib/clinical/clinical-signs";

describe("clinical-signs", () => {
  it("parses the canonical array on baselineExamFindings.clinicalSigns", () => {
    const signs = parseClinicalSigns({
      clinicalSigns: [
        {
          signName: "Segno di Murphy",
          result: "Positivo, interruzione dell'atto respiratorio",
          isPositive: true,
        },
      ],
    });
    assert.equal(signs.length, 1);
    assert.equal(signs[0].signName, "Segno di Murphy");
    assert.equal(signs[0].isPositive, true);
  });

  it("parses a dictionary and the semeiotics alias", () => {
    const signs = parseClinicalSigns({
      semeiotics: {
        blumberg: {
          signName: "Segno di Blumberg",
          result: "Negativo, nessun dolore di rimbalzo",
          isPositive: false,
        },
        babinski: "Iperestensione dell'alluce, positivo",
      },
    });
    assert.equal(signs.length, 2);
    assert.equal(
      matchClinicalSign(signs, { label: "Blumberg" })?.isPositive,
      false,
    );
    assert.equal(matchClinicalSign(signs, { label: "Babinski" })?.isPositive, true);
  });

  it("serializes the same JSON injected into the patient prompt", () => {
    const baseline = {
      clinicalSigns: [
        {
          signName: "Segno di Murphy",
          result: "Positivo, interruzione dell'atto respiratorio",
          isPositive: true,
        },
      ],
    };
    assert.equal(serializeClinicalSignsJson(baseline), JSON.stringify(parseClinicalSigns(baseline)));
    assert.equal(
      formatClinicalSignFinding(parseClinicalSigns(baseline)[0]),
      "Positivo, interruzione dell'atto respiratorio",
    );
    assert.equal(clinicalSignExamId(parseClinicalSigns(baseline)[0]), "semeiotic:murphy");
  });
});
