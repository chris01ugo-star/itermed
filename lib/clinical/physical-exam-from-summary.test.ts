import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { derivePhysicalExamFromSummary } from "@/lib/clinical/physical-exam-from-summary";

describe("physical-exam-from-summary", () => {
  it("does not copy the abdominal AAA summary onto heart and lungs", () => {
    const derived = derivePhysicalExamFromSummary({
      summary:
        "All'esame fisico, Giovanni presenta un addome teso e dolente alla palpazione, con segni di possibile irritazione peritoneale. La frequenza cardiaca è elevata e la saturazione di ossigeno è bassa. Non si riscontrano soffi cardiaci anomali.",
      killipClass: "III",
      heartRate: 102,
    });
    assert.match(derived.addomePalpation, /dolente/i);
    assert.doesNotMatch(derived.cardiovascolare, /addome teso/i);
    assert.match(derived.cardiovascolare, /soffi assenti|non si riscontrano soffi/i);
    assert.match(derived.torace, /rantoli/i);
    assert.notEqual(derived.addomePalpation, derived.torace);
    assert.notEqual(derived.addomePalpation, derived.cardiovascolare);
  });

  it("records a pulsatile mass when the vignette mentions it", () => {
    const derived = derivePhysicalExamFromSummary({
      summary: "All'esame fisico presenta un addome teso e dolente alla palpazione.",
      context: "Uomo 77 anni con dolore addominale e massa pulsatile",
      killipClass: "I",
    });
    assert.match(derived.addomePalpation, /massa pulsante/i);
  });
});
