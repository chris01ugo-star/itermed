/**
 * Coaching empatia ancorato ai turni reali.
 *
 *   npx tsx --test lib/services/empathy-neuro-rubric.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildEmpathyNeuroCoaching, mergeEmpathyCoaching } from "@/lib/services/empathy-neuro-rubric";

describe("buildEmpathyNeuroCoaching", () => {
  it("cita verbatim una frase dello studente e propone una riformulazione", () => {
    const quote = "Capisco che questa mancanza di fiato la spaventi.";
    const result = buildEmpathyNeuroCoaching([
      { role: "assistant", content: "Ho paura di morire stanotte." },
      { role: "user", content: quote },
      { role: "assistant", content: "Sono solo e abbandonato." },
      { role: "user", content: "Stia tranquillo, andrà tutto bene." },
    ]);
    assert.match(result.text, /Capisco che questa mancanza di fiato la spaventi/);
    assert.match(result.text, /Stia tranquillo, andrà tutto bene/);
    assert.ok(result.strengths.length >= 1);
    assert.ok(result.missed.length >= 1);
  });

  it("non sostituisce le citazioni dei turni quando arriva un chunk RAG", () => {
    const neuro = buildEmpathyNeuroCoaching([
      { role: "assistant", content: "Ho paura che sia grave." },
      { role: "user", content: "Vedo che questa paura la tiene sveglio." },
    ]);
    const merged = mergeEmpathyCoaching({
      neuro,
      ragFeedback: "Lieberman, affect labeling.",
      empathyChunksPresent: true,
    });
    assert.match(merged, /Vedo che questa paura la tiene sveglio/);
    assert.match(merged, /Lieberman/);
  });

  it("ignora il testo RAG se il pilastro empatia non ha chunk", () => {
    const neuro = buildEmpathyNeuroCoaching([
      { role: "user", content: "Mi dica da quando ha il dolore." },
    ]);
    const merged = mergeEmpathyCoaching({
      neuro,
      ragFeedback: "Testo che non deve comparire.",
      empathyChunksPresent: false,
    });
    assert.equal(merged, neuro.text);
    assert.doesNotMatch(merged, /non deve comparire/);
  });
});
