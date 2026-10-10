/**
 *   npx tsx --test lib/services/specialty-scope.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EMPATHY_SPECIALTY,
  UNIVERSAL_SPECIALTY,
  isUniversalSpecialty,
  pineconeSpecialtyInFilter,
  readSecondarySpecialties,
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
