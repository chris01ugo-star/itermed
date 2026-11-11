/**
 *   npx tsx --test lib/data/cases/load-kb-case-file.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadKnowledgeBaseCaseFromDisk } from "@/lib/data/cases/load-kb-case-file";
import { buildPatientSystemPrompt } from "@/lib/simulator/patient-system-prompt";
import type { ClinicalCase } from "@/lib/data/cases/types";

function promptFor(c: ClinicalCase): string {
  const vitals =
    c.baselineExamFindings.vitals && typeof c.baselineExamFindings.vitals === "object"
      ? JSON.stringify(c.baselineExamFindings.vitals)
      : "{}";
  return buildPatientSystemPrompt({
    patientAge: "n/d",
    patientSex: "F",
    chiefComplaint: c.description,
    clinicalStory: c.description,
    setting: c.setting,
    condition: c.condition,
    presentation: c.presentation,
    pastMedicalHistory: c.pastMedicalHistory,
    redHerrings: c.redHerrings,
    anamnesisClues: c.anamnesisQuestions.map((question) => ({
      prompt: question.prompt,
      rationale: question.rationale,
    })),
    physicalExamSummary: c.physicalExam.summary,
    patientProfile: c.patientProfile,
    vitalSigns: vitals,
    patientStress: 20,
    trueDiagnosis: c.correctSolution,
    abnormalExams: "",
    clinicalSignsJson: "[]",
    painNrs: null,
    roleplayScript: c.patientPrompt,
  });
}

describe("disk case realism", () => {
  for (const id of ["INTMED-005", "EMAT-007", "GERIA-022"] as const) {
    it(`loads ${id} from disk into a first-person prompt`, async () => {
      const loaded = await loadKnowledgeBaseCaseFromDisk(id);
      assert.ok(loaded, `${id} missing on disk`);
      assert.ok(loaded.setting);
      assert.ok(loaded.condition);
      assert.ok(loaded.presentation);
      assert.ok(loaded.pastMedicalHistory);
      assert.ok(loaded.patientPrompt.length > 20);
      assert.ok(loaded.anamnesisQuestions.length > 0);
      assert.ok(loaded.physicalExam.summary);

      const prompt = promptFor(loaded);
      assert.match(prompt, /COME GESTIRE IL TUO COPIONE/);
      assert.match(prompt, /racconta SOLO come ti senti/);
      assert.match(prompt, /vorrebbe sapere/);
      assert.match(prompt, /ADESSO SEI SOLO QUESTO PAZIENTE/);
      assert.doesNotMatch(prompt, /NON conosci la parola/);
      assert.match(prompt, new RegExp(loaded.condition!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.match(prompt, /Reparto di degenza|Ambulatorio|Pronto Soccorso|Guardia medica/);
      const personaAt = prompt.lastIndexOf("ADESSO SEI SOLO QUESTO PAZIENTE");
      assert.ok(personaAt > prompt.indexOf("Rispondi solo come il paziente"));
    });
  }

  it("does not invent a file for GASTRO-013", async () => {
    const loaded = await loadKnowledgeBaseCaseFromDisk("GASTRO-013");
    assert.equal(loaded, undefined);
  });
});
