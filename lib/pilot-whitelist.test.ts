/**
 * npx tsx --test lib/pilot-whitelist.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isBetaAuthorized } from "@/lib/beta/access";
import {
  isPilotAllowedEmail,
  PILOT_ALLOWED_EMAILS,
  PILOT_SIMULATION_CAP,
} from "@/lib/pilot-whitelist";

describe("pilot whitelist", () => {
  it("contains 14 normalized emails", () => {
    assert.equal(PILOT_ALLOWED_EMAILS.length, 14);
    for (const email of PILOT_ALLOWED_EMAILS) {
      assert.equal(email, email.toLowerCase().trim());
      assert.equal(isPilotAllowedEmail(email), true);
    }
  });

  it("matches emails case-insensitively and ignores surrounding spaces", () => {
    assert.equal(isPilotAllowedEmail("  Pirozzi.Ludmilla@Gmail.com  "), true);
    assert.equal(isPilotAllowedEmail("FERAS.ELBALLOUZ@EDU.UNITO.IT"), true);
    assert.equal(isPilotAllowedEmail("not-a-tester@example.com"), false);
    assert.equal(isPilotAllowedEmail(""), false);
    assert.equal(isPilotAllowedEmail(null), false);
  });

  it("exposes a lifetime Pilot Cap of 3", () => {
    assert.equal(PILOT_SIMULATION_CAP, 3);
  });
});

describe("isBetaAuthorized", () => {
  it("authorizes a pilot tester even with FREE plan", () => {
    assert.equal(
      isBetaAuthorized({
        role: "STUDENT",
        planType: "FREE",
        email: "ariannaallegretti2003@gmail.com",
      }),
      true,
    );
  });

  it("does not authorize a BETA_TESTER plan that is off the whitelist", () => {
    assert.equal(
      isBetaAuthorized({
        role: "STUDENT",
        planType: "BETA_TESTER",
        email: "random.student@unito.it",
      }),
      false,
    );
  });
});
