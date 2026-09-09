/**
 * npx tsx --test lib/billing/unlimited-case-access.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AUDIT_UNLIMITED_CASE_EMAIL,
  SPONSORED_FREE_CASE_EMAIL,
  SPONSORED_FREE_CASE_LIMIT,
  hasActiveSponsoredCaseGrant,
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

  it("does not grant regular users or the sponsored grant email as unlimited", () => {
    assert.equal(hasUnlimitedCaseAccess({ role: "STUDENT", email: "learner@example.com" }), false);
    assert.equal(hasUnlimitedCaseAccess({ role: "INSTRUCTOR", email: "doc@example.com" }), false);
    assert.equal(hasUnlimitedCaseAccess(null), false);
    assert.equal(hasUnlimitedCaseAccess({ role: "STUDENT", email: null }), false);
    assert.equal(
      hasUnlimitedCaseAccess({ role: "STUDENT", email: SPONSORED_FREE_CASE_EMAIL }),
      false,
    );
  });
});

describe("hasActiveSponsoredCaseGrant", () => {
  it("matches the sponsored email case-insensitively with trim", () => {
    assert.equal(
      hasActiveSponsoredCaseGrant({ email: "  Robquellodelfonendo@gmail.com " }, 0),
      true,
    );
    assert.equal(hasActiveSponsoredCaseGrant({ email: SPONSORED_FREE_CASE_EMAIL }, 19), true);
  });

  it("expires after 20 lifetime sessions", () => {
    assert.equal(
      hasActiveSponsoredCaseGrant({ email: SPONSORED_FREE_CASE_EMAIL }, SPONSORED_FREE_CASE_LIMIT),
      false,
    );
    assert.equal(hasActiveSponsoredCaseGrant({ email: SPONSORED_FREE_CASE_EMAIL }, 21), false);
  });

  it("does not apply to other accounts", () => {
    assert.equal(hasActiveSponsoredCaseGrant({ email: "learner@example.com" }, 0), false);
    assert.equal(hasActiveSponsoredCaseGrant({ email: AUDIT_UNLIMITED_CASE_EMAIL }, 0), false);
    assert.equal(hasActiveSponsoredCaseGrant(null, 0), false);
  });
});
