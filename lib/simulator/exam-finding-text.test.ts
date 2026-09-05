import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  adaptFindingForRequestedExam,
  pickCaseFindingText,
  sanitizeExamFinding,
} from "@/lib/simulator/exam-finding-text";

const AAA_BLOB =
  "Ecografia (addome, tiroide, mammella, muscolotendinea, pelvica) nel contesto di Aneurisma dell'aorta addominale (CARDIO-026). ECG: tachicardia sinusale; Emocromo: possibile anemia; Ecografia: evidenza di aneurisma dell'aorta addominale; Creatinina: da valutare.";

describe("exam-finding-text", () => {
  it("keeps only the requested exam clause from a leaked composite", () => {
    const eco = sanitizeExamFinding("ecografia", AAA_BLOB);
    assert.match(eco, /aneurisma dell'aorta addominale/i);
    assert.doesNotMatch(eco, /da valutare/i);
    assert.doesNotMatch(eco, /emocromo/i);
    assert.doesNotMatch(eco, /CARDIO-026/);

    const cbc = sanitizeExamFinding("emocromo", AAA_BLOB);
    assert.match(cbc, /anemia/i);
    assert.doesNotMatch(cbc, /creatinina/i);
    assert.doesNotMatch(cbc, /eseguire|valutare/i);
  });

  it("drops advice-only creatinine clauses", () => {
    const creat = sanitizeExamFinding("creat-urea-gfr", AAA_BLOB);
    assert.doesNotMatch(creat, /da valutare/i);
    assert.doesNotMatch(creat, /iniziare|eseguire/i);
  });

  it("adapts an abdominal ultrasound finding into a FAST report", () => {
    const eco = sanitizeExamFinding("ecografia", AAA_BLOB);
    const fast = adaptFindingForRequestedExam("fast", "ecografia", eco);
    assert.match(fast, /FAST/i);
    assert.match(fast, /versamento/i);
    assert.match(fast, /aorta/i);
  });

  it("reuses ecografia when FAST has no override", () => {
    const picked = pickCaseFindingText("fast", {
      ecografia: { normalFinding: AAA_BLOB },
    });
    assert.equal(picked?.sourceId, "ecografia");
  });
});
