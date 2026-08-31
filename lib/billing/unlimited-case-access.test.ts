/**
 * npx tsx --test lib/billing/unlimited-case-access.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AUDIT_UNLIMITED_CASE_EMAIL,
  hasUnlimitedCaseAccess,
} from "@/lib/billing/unlimited-case-access";

describe("hasUnlimitedCaseAccess", () => {
  it("grants ADMIN regardless of email", () => {
    assert.equal(hasUnlimitedCaseAccess({ role: "ADMIN", email: "student@example.com" }), true);
  });

  it("grants the audit email even as STUDENT", () => {
    assert.equal(
      hasUnlimitedCaseAccess({ role: "STUDENT", email: AUDIT_UNLIMITED_CASE_EMAIL }),
      true,
    );
    assert.equal(
      hasUnlimitedCaseAccess({ role: "STUDENT", email: "  Chris01.Ugo@gmail.com " }),
      true,
    );
  });

  it("does not grant regular users", () => {
    assert.equal(hasUnlimitedCaseAccess({ role: "STUDENT", email: "learner@example.com" }), false);
    assert.equal(hasUnlimitedCaseAccess({ role: "INSTRUCTOR", email: "doc@example.com" }), false);
    assert.equal(hasUnlimitedCaseAccess(null), false);
    assert.equal(hasUnlimitedCaseAccess({ role: "STUDENT", email: null }), false);
  });
});
