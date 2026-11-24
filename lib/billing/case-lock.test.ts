/**
 * npx tsx --test lib/billing/case-lock.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isCaseLockedForLearner, lockedCaseMayOpenBriefing } from "@/lib/billing/case-lock";

describe("Prassi folder lock", () => {
  it("locks unpaid learners and lets admins through", () => {
    assert.equal(isCaseLockedForLearner({ requiresPaidPlan: true, adminBypass: false }), true);
    assert.equal(isCaseLockedForLearner({ requiresPaidPlan: true, adminBypass: true }), false);
    assert.equal(isCaseLockedForLearner({ requiresPaidPlan: false, adminBypass: false }), false);
  });

  it("does not open a locked unused case; completed reports stay readable", () => {
    assert.equal(
      lockedCaseMayOpenBriefing({
        requiresPaidPlan: true,
        adminBypass: false,
        playStatus: "todo",
      }),
      false,
    );
    assert.equal(
      lockedCaseMayOpenBriefing({
        requiresPaidPlan: true,
        adminBypass: false,
        playStatus: "in_progress",
        lastReportId: "rep_1",
      }),
      false,
    );
    assert.equal(
      lockedCaseMayOpenBriefing({
        requiresPaidPlan: true,
        adminBypass: false,
        playStatus: "completed",
        lastReportId: "rep_1",
      }),
      true,
    );
    assert.equal(
      lockedCaseMayOpenBriefing({
        requiresPaidPlan: true,
        adminBypass: false,
        playStatus: "completed",
      }),
      false,
    );
  });
});
