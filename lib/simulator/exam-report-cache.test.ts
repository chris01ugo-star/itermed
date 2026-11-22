import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EXAM_REPORT_CACHE_PROMPT_VERSION,
  buildExamCacheContextKey,
  planExamReportCache,
} from "@/lib/simulator/exam-report-cache";

const baseline = {
  repeatCount: 0,
  deteriorationTriggered: false,
  prescribedDrugs: [] as string[],
  executedInterventions: [] as string[],
};

describe("exam report baseline cache key", () => {
  it("keeps prompt version v1 for clean invalidation", () => {
    assert.equal(EXAM_REPORT_CACHE_PROMPT_VERSION, "v1");
  });

  it("is baseline on the opening turn and after diagnostic maneuvers only", () => {
    assert.equal(buildExamCacheContextKey(baseline), "baseline");
    assert.equal(
      buildExamCacheContextKey({
        ...baseline,
        executedInterventions: ["auscultazione toracica", "GCS", "pupille", "palpazione addome"],
      }),
      "baseline",
    );
  });

  it("drops the shared key after drugs, oxygen, therapy, deterioration, or a repeat", () => {
    assert.equal(
      buildExamCacheContextKey({ ...baseline, prescribedDrugs: ["Furosemide"] }),
      null,
    );
    for (const intervention of [
      "ossigenoterapia",
      "ventilazione NIV",
      "fluidi",
      "analgesia",
      "defibrillazione",
      "cardioversione",
      "trasfusione",
    ]) {
      assert.equal(
        buildExamCacheContextKey({ ...baseline, executedInterventions: [intervention] }),
        null,
        intervention,
      );
    }
    assert.equal(buildExamCacheContextKey({ ...baseline, deteriorationTriggered: true }), null);
    assert.equal(buildExamCacheContextKey({ ...baseline, repeatCount: 1 }), null);
  });

  it("serves a shared baseline hit with zero LLM calls", () => {
    const plan = planExamReportCache({
      ...baseline,
      executedInterventions: ["auscultazione", "GCS", "pupille"],
      sessionHit: false,
      sharedRowPresent: true,
    });
    assert.deepEqual(plan, { examCache: "shared_hit", llmCalls: 0, contextKey: "baseline" });
  });

  it("generates dynamically when the context is no longer baseline, even if a shared row exists", () => {
    const cases = [
      { ...baseline, prescribedDrugs: ["Morfina"] },
      { ...baseline, executedInterventions: ["ossigeno"] },
      { ...baseline, deteriorationTriggered: true },
      { ...baseline, repeatCount: 2 },
    ];
    for (const input of cases) {
      const plan = planExamReportCache({ ...input, sessionHit: false, sharedRowPresent: true });
      assert.equal(plan.examCache, "miss");
      assert.equal(plan.llmCalls, 1);
      if (plan.examCache === "miss") assert.equal(plan.contextKey, null);
    }
  });

  it("uses the session copy before the shared cache", () => {
    const plan = planExamReportCache({
      ...baseline,
      sessionHit: true,
      sharedRowPresent: true,
    });
    assert.deepEqual(plan, { examCache: "session", llmCalls: 0 });
  });
});
