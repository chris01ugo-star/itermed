/**
 *   npx tsx --test lib/simulator/patient-grammatical-gender.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractPatientGivenName,
  inferGrammaticalGenderFromGivenName,
  italianAgreementPhrase,
  resolvePatientGrammaticalGender,
  resolvePatientPersona,
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

  it("infers sex from the given name when no dedicated field exists", () => {
    assert.equal(inferGrammaticalGenderFromGivenName("Federica"), "F");
    assert.equal(inferGrammaticalGenderFromGivenName("Anna"), "F");
    assert.equal(inferGrammaticalGenderFromGivenName("Luca"), "M");
    assert.equal(inferGrammaticalGenderFromGivenName("Andrea"), "M");
  });

  it("extracts the anagraphic name and prefers an explicit sex field", () => {
    assert.equal(extractPatientGivenName("Sei Anna, 71 anni. Sei ipertesa."), "Anna");

    const fromNarrative = resolvePatientPersona({
      explicitSex: "",
      texts: ["Sei Federica, 44 anni. Sono molto stanca e preoccupata."],
    });
    assert.equal(fromNarrative.name, "Federica");
    assert.equal(fromNarrative.gender, "F");
    assert.equal(fromNarrative.sexLabel, "DONNA/FEMMINA");

    const explicitWins = resolvePatientPersona({
      explicitSex: "M",
      texts: ["Donna, 71 anni. Sei Anna, sei ipertesa."],
    });
    assert.equal(explicitWins.gender, "M");
    assert.equal(explicitWins.name, "Anna");
  });

  it("infers female sex from case wording when the name is absent", () => {
    const persona = resolvePatientPersona({
      explicitSex: "(non specificato)",
      texts: ["Donna, 71 anni, giunge in PS per palpitazioni."],
    });
    assert.equal(persona.gender, "F");
    assert.equal(persona.sexLabel, "DONNA/FEMMINA");
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
