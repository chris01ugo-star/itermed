/**
 *   npx tsx --test lib/services/specialty-scope.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EMPATHY_SPECIALTY,
  UNIVERSAL_SPECIALTY,
  canonicalSpecialtyName,
  isPlaceholderFilename,
  isPlaceholderGuidelineLabel,
  isUniversalSpecialty,
  pineconeSpecialtyInFilter,
  readSecondarySpecialties,
  specialtyNameFromCaseId,
  specialtyScopeValues,
} from "@/lib/services/specialty-scope";

describe("specialty scope", () => {
  it("treats generale and empatia as shared corpora", () => {
    assert.equal(isUniversalSpecialty("generale"), true);
    assert.equal(isUniversalSpecialty(" Generale "), true);
    assert.equal(isUniversalSpecialty("empatia"), true);
    assert.equal(isUniversalSpecialty("cardiologia"), false);
  });

  it("always includes generale and empatia beside the current specialty", () => {
    const values = specialtyScopeValues("Cardiologia");
    assert.ok(values.includes("Cardiologia"));
    assert.ok(values.includes("cardiologia"));
    assert.ok(values.includes(UNIVERSAL_SPECIALTY));
    assert.ok(values.includes(EMPATHY_SPECIALTY));
    assert.deepEqual(pineconeSpecialtyInFilter("cardiologia"), {
      specialty: { $in: specialtyScopeValues("cardiologia") },
    });
  });

  it("expands the filter with secondary specialties", () => {
    const values = specialtyScopeValues("Pneumologia", ["cardiologia"]);
    assert.ok(values.includes("Pneumologia"));
    assert.ok(values.includes("cardiologia"));
    assert.ok(values.includes("Cardiologia"));
    assert.ok(values.includes(UNIVERSAL_SPECIALTY));
    assert.ok(values.includes(EMPATHY_SPECIALTY));
    assert.deepEqual(pineconeSpecialtyInFilter("Pneumologia", ["cardiologia"]), {
      specialty: { $in: values },
    });
  });

  it("resolves knowledge-base aliases to the exact MedicalSpecialty name", () => {
    assert.equal(canonicalSpecialtyName("cardiologia"), "Cardiologia");
    assert.equal(canonicalSpecialtyName("PNEUMOLOGIA"), "Pneumologia");
    assert.equal(
      canonicalSpecialtyName("medicina d'emergenza-urgenza"),
      "Medicina d'Emergenza-Urgenza",
    );
    assert.equal(
      canonicalSpecialtyName("MEDICINA D'EMERGENZA-URGENZA"),
      "Medicina d'Emergenza-Urgenza",
    );
    assert.equal(canonicalSpecialtyName("medicina_urgenza"), "Medicina d'Emergenza-Urgenza");
    assert.equal(canonicalSpecialtyName("malattie_infettive"), "Malattie Infettive");
    assert.equal(canonicalSpecialtyName("medicina_laboratorio"), "Medicina di Laboratorio");
    assert.equal(canonicalSpecialtyName("reumatologia"), "Reumatologia");
    const scoped = specialtyScopeValues("medicina d'emergenza-urgenza");
    assert.ok(scoped.includes("Medicina d'Emergenza-Urgenza"));
    assert.ok(scoped.includes(UNIVERSAL_SPECIALTY));
    assert.ok(scoped.includes(EMPATHY_SPECIALTY));
  });

  it("maps case id prefixes onto the canonical specialty", () => {
    assert.equal(specialtyNameFromCaseId("CARDIO-001"), "Cardiologia");
    assert.equal(specialtyNameFromCaseId("PNEUMO-001"), "Pneumologia");
    assert.equal(specialtyNameFromCaseId("EMAT-012"), "Ematologia");
    assert.equal(specialtyNameFromCaseId("NEURO-004"), "Neurologia");
    assert.equal(specialtyNameFromCaseId("GERIA-016"), "Geriatria");
    assert.equal(specialtyNameFromCaseId("ONCO-003"), "Oncologia");
    assert.equal(specialtyNameFromCaseId("REUMA-002"), "Reumatologia");
    assert.equal(specialtyNameFromCaseId("PSICH-001"), "Psichiatria");
    assert.equal(specialtyNameFromCaseId("GASTRO-001"), "Gastroenterologia");
    assert.equal(specialtyNameFromCaseId("INFETT-001"), "Malattie Infettive");
    assert.equal(specialtyNameFromCaseId("MEU-001"), "Medicina d'Emergenza-Urgenza");
    assert.equal(specialtyNameFromCaseId("MI-001"), "Medicina Interna");
    assert.equal(specialtyNameFromCaseId("LAB-001"), "Medicina di Laboratorio");
    assert.equal(specialtyNameFromCaseId("MIELO-001"), undefined);
  });

  it("recognizes placeholder documents and filenames", () => {
    assert.equal(isPlaceholderFilename("placeholder.md"), true);
    assert.equal(isPlaceholderFilename("knowledge_base/cardiologia/legal/Placeholder.PDF"), true);
    assert.equal(isPlaceholderFilename("ESC_2023_ACS_Guidelines.pdf"), false);
    assert.equal(isPlaceholderGuidelineLabel("[LEGAL] placeholder"), true);
    assert.equal(
      isPlaceholderGuidelineLabel("Legge Gelli", "knowledge_base/cardiologia/legal/placeholder.md"),
      true,
    );
    assert.equal(isPlaceholderGuidelineLabel("Legge_24_2017_Gelli_Bianco"), false);
  });

  it("reads secondary_specialties from a case payload", () => {
    assert.deepEqual(readSecondarySpecialties({ secondary_specialties: ["cardiologia", " Cardiologia "] }), [
      "cardiologia",
    ]);
    assert.deepEqual(readSecondarySpecialties({ secondarySpecialties: ["gastroenterologia"] }), [
      "gastroenterologia",
    ]);
    assert.deepEqual(readSecondarySpecialties({}), []);
  });
});
