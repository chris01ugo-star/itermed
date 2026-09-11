/**
 * Structured prescription trace used by the Ricettario / evaluation LLM.
 *
 *   npx tsx --test lib/simulator/prescription-trace.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatPrescriptionTrace,
  isPrescriptionTrace,
  mergePrescriptionTracesIntoChat,
  parseSessionPrescriptions,
} from "./prescription-trace";

describe("prescription-trace", () => {
  it("formats the canonical Azione medica string with via, posology and SSN cost", () => {
    const line = formatPrescriptionTrace({
      commercialName: "Lasix",
      activeIngredient: "Furosemide",
      dosageForm: "compresse 25mg",
      price: 1.76,
      route: "orale",
      posology: "1 cp ogni 12 ore",
    });
    assert.equal(
      line,
      "[AZIONE_MEDICA: PRESCRIZIONE] L'utente ha prescritto Lasix (Furosemide) compresse 25mg - Via: orale - Posologia: 1 cp ogni 12 ore - Costo SSN impattato: 1.76€.",
    );
    assert.equal(isPrescriptionTrace(line), true);
  });

  it("parses session JSON and merges missing traces into chat history", () => {
    const parsed = parseSessionPrescriptions([
      {
        id: "m1",
        commercialName: "Eliquis",
        activeIngredient: "Apixaban",
        dosageForm: "compresse 5mg",
        price: 60,
        category: "Cardiologia",
        route: "orale",
        posology: "1 cp ogni 12 ore",
        prescribedAt: "2026-09-11T00:00:00.000Z",
      },
    ]);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0]?.posology, "1 cp ogni 12 ore");
    assert.match(parsed[0]?.trace ?? "", /Via: orale - Posologia: 1 cp ogni 12 ore/);
    const merged = mergePrescriptionTracesIntoChat(
      [{ role: "user", content: "Come sta?" }],
      parsed,
    );
    assert.equal(merged.length, 2);
    assert.equal(merged[1]?.role, "user");
    assert.match(merged[1]?.content ?? "", /AZIONE_MEDICA: PRESCRIZIONE/);
  });
});
