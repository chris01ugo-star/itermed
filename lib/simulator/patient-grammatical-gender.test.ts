/**
 *   npx tsx --test lib/simulator/patient-grammatical-gender.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  italianAgreementPhrase,
  resolvePatientGrammaticalGender,
} from "@/lib/simulator/patient-grammatical-gender";

describe("patient grammatical gender", () => {
  it("maps F / femminile / female to F", () => {
    assert.equal(resolvePatientGrammaticalGender("F"), "F");
    assert.equal(resolvePatientGrammaticalGender("femminile"), "F");
    assert.equal(resolvePatientGrammaticalGender("Femmina"), "F");
    assert.equal(resolvePatientGrammaticalGender("female"), "F");
  });

  it("maps M / maschile / male to M", () => {
    assert.equal(resolvePatientGrammaticalGender("M"), "M");
    assert.equal(resolvePatientGrammaticalGender("Maschio"), "M");
    assert.equal(resolvePatientGrammaticalGender("male"), "M");
  });

  it("builds the Italian agreement phrase for each sex", () => {
    assert.equal(
      italianAgreementPhrase("F"),
      "femminile (es. sono andata, sono stanca, sono preoccupata)",
    );
    assert.equal(
      italianAgreementPhrase("M"),
      "maschile (es. sono andato, sono stanco, sono preoccupato)",
    );
  });
});
