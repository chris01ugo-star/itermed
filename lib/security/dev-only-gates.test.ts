/**
 * Production invariant: client quota/auth bypasses are inert unless NODE_ENV=development.
 *
 *   npx tsx --test lib/security/dev-only-gates.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canHonorDailyLimitBypass,
  isClientDevBypassHonored,
  isRuntimeDevelopment,
  rejectNonDevelopmentDevBypass,
} from "@/lib/security/dev-only-gates";

describe("dev-only gates", () => {
  it("mirrors process.env.NODE_ENV === 'development' exactly", () => {
    assert.equal(isRuntimeDevelopment(), process.env.NODE_ENV === "development");
    assert.equal(isClientDevBypassHonored(), process.env.NODE_ENV === "development");
  });

  it("honors bypassDailyLimit only on next dev", () => {
    const expected = process.env.NODE_ENV === "development";
    assert.equal(canHonorDailyLimitBypass(true), expected);
    assert.equal(canHonorDailyLimitBypass(false), false);
    assert.equal(canHonorDailyLimitBypass(undefined), false);
  });

  it("returns 403 when devBypass:true is sent outside development", async () => {
    const res = rejectNonDevelopmentDevBypass(true);
    if (process.env.NODE_ENV === "development") {
      assert.equal(res, null);
      return;
    }
    assert.ok(res instanceof Response);
    assert.equal(res!.status, 403);
    const body = (await res!.json()) as { code?: string };
    assert.equal(body.code, "DEV_BYPASS_FORBIDDEN");
  });

  it("does not reject omitted or false devBypass", () => {
    assert.equal(rejectNonDevelopmentDevBypass(undefined), null);
    assert.equal(rejectNonDevelopmentDevBypass(false), null);
  });
});
