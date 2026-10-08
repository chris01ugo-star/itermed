/**
 * Bilancio SSN: esami + farmaci.
 *
 *   npx tsx --test lib/services/evaluation-economy-ssn.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CaseExamDefinition } from "@/lib/data/cases/types";
import { computeEconomySsnScore } from "@/lib/services/evaluation-economy-ssn";

const ecg: CaseExamDefinition = {
  examId: "ecg",
  name: "ECG",
  level: "I",
  mandatory: true,
  finding: "Ritmo sinusale",
  priceEuro: 80,
};

function drug(id: string, name: string, price: number) {
  return { id, commercialName: name, activeIngredient: name, price };
}

const matrix = {
  therapyMatrix: {
    indicated: [{ id: "furosemide", label: "Furosemide", priceEuro: 4.5 }],
    inappropriate: [{ id: "amoxicillina", label: "Amoxicillina" }],
    contraindicated: [{ id: "verapamil", label: "Verapamil" }],
  },
};

describe("computeEconomySsnScore medications", () => {
  it("keeps exam-only spend when no prescriptions are present", () => {
    const result = computeEconomySsnScore({
      totalCostEuro: 100,
      budgetEuro: 200,
      orderedExams: [{ id: "ecg", name: "ECG", cost: 100 }],
      mandatoryExams: [ecg],
    });
    assert.equal(result.examSpendEuro, 100);
    assert.equal(result.medicationSpendEuro, 0);
    assert.equal(result.actualSpendEuro, 100);
    assert.equal(result.idealSpendEuro, 80);
    assert.equal(result.wasteEuro, 0);
  });

  it("adds an indicated drug to actual and ideal spend", () => {
    const result = computeEconomySsnScore({
      totalCostEuro: 100,
      budgetEuro: 200,
      orderedExams: [{ id: "ecg", name: "ECG", cost: 100 }],
      mandatoryExams: [ecg],
      baselineExamFindings: matrix,
      prescribedMedications: [drug("furosemide", "Lasix", 12.5)],
    });
    assert.equal(result.examSpendEuro, 100);
    assert.equal(result.medicationSpendEuro, 12.5);
    assert.equal(result.actualSpendEuro, 112.5);
    assert.equal(result.idealSpendEuro, 92.5);
    assert.equal(result.wasteEuro, 0);
    assert.equal(
      result.prescriptions.virtuous.some((item) => item.name.startsWith("Lasix")),
      true,
    );
  });

  it("counts the full cost of inappropriate and contraindicated drugs as waste", () => {
    const baseline = computeEconomySsnScore({
      totalCostEuro: 100,
      budgetEuro: 200,
      orderedExams: [{ id: "ecg", name: "ECG", cost: 100 }],
      mandatoryExams: [ecg],
      baselineExamFindings: matrix,
    });
    const result = computeEconomySsnScore({
      totalCostEuro: 100,
      budgetEuro: 200,
      orderedExams: [{ id: "ecg", name: "ECG", cost: 100 }],
      mandatoryExams: [ecg],
      baselineExamFindings: matrix,
      prescribedMedications: [drug("amoxicillina", "Augmentin", 20), drug("verapamil", "Isoptin", 15)],
    });
    assert.equal(result.actualSpendEuro, 135);
    assert.equal(result.idealSpendEuro, 84.5);
    assert.equal(result.wasteEuro, 35);
    assert.ok(result.score < baseline.score);
    assert.equal(
      result.prescriptions.inappropriate.filter((item) => item.costEuro === 20 || item.costEuro === 15)
        .length,
      2,
    );
  });

  it("raises actual spend for an unclassified drug without counting it as waste", () => {
    const result = computeEconomySsnScore({
      totalCostEuro: 100,
      budgetEuro: 200,
      orderedExams: [{ id: "ecg", name: "ECG", cost: 100 }],
      mandatoryExams: [ecg],
      baselineExamFindings: matrix,
      prescribedMedications: [drug("tachipirina", "Tachipirina", 8)],
    });
    assert.equal(result.actualSpendEuro, 108);
    assert.equal(result.idealSpendEuro, 84.5);
    assert.equal(result.wasteEuro, 0);
    assert.equal(
      result.prescriptions.inappropriate.some((item) => item.name.startsWith("Tachipirina")),
      false,
    );
  });

  it("adds the authored price of an omitted indicated drug to ideal spend and omissions", () => {
    const result = computeEconomySsnScore({
      totalCostEuro: 100,
      budgetEuro: 200,
      orderedExams: [{ id: "ecg", name: "ECG", cost: 100 }],
      mandatoryExams: [ecg],
      baselineExamFindings: matrix,
    });
    assert.equal(result.idealSpendEuro, 84.5);
    assert.equal(result.omissionEuro, 4.5);
    assert.equal(
      result.prescriptions.omissions.some((item) => item.name === "Furosemide" && item.costEuro === 4.5),
      true,
    );
  });
});
