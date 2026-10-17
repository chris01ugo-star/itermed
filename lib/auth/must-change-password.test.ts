/**
 * npx tsx --test lib/auth/must-change-password.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MUST_CHANGE_PASSWORD_CODE,
  MUST_CHANGE_PASSWORD_PATH,
  isProvisionedOrBetaTesterAccount,
  shouldForcePasswordChange,
  validateNewPassword,
} from "@/lib/auth/must-change-password";

describe("shouldForcePasswordChange", () => {
  it("blocks invited users until they change the temp password", () => {
    assert.equal(
      shouldForcePasswordChange({
        mustChangePassword: true,
        email: "studente@unito.it",
      }),
      true,
    );
  });

  it("blocks existing admin-created accounts even without the new flag", () => {
    assert.equal(
      shouldForcePasswordChange({
        mustChangePassword: false,
        planType: "INVITED",
        email: "studente@unito.it",
      }),
      true,
    );
  });

  it("blocks existing beta testers until they set a personal password", () => {
    assert.equal(
      shouldForcePasswordChange({
        mustChangePassword: false,
        planType: "BETA_TESTER",
        email: "tester@unito.it",
      }),
      true,
    );
    assert.equal(
      shouldForcePasswordChange({
        mustChangePassword: false,
        planType: "FREE",
        email: "pirozzi.ludmilla@gmail.com",
      }),
      true,
    );
  });

  it("lets the user through after they complete the password form", () => {
    assert.equal(
      shouldForcePasswordChange({
        mustChangePassword: false,
        passwordChangedAt: new Date("2026-10-15T00:00:00.000Z"),
        planType: "INVITED",
        email: "studente@unito.it",
      }),
      false,
    );
  });

  it("lets unrelated accounts through", () => {
    assert.equal(
      shouldForcePasswordChange({
        mustChangePassword: false,
        planType: "FREE",
        email: "esterno@example.com",
      }),
      false,
    );
    assert.equal(
      shouldForcePasswordChange({
        mustChangePassword: undefined,
        email: "esterno@example.com",
      }),
      false,
    );
  });

  it("never blocks platform admins", () => {
    assert.equal(
      shouldForcePasswordChange({
        mustChangePassword: true,
        planType: "BETA_TESTER",
        email: "dariobarbagallo46@gmail.com",
      }),
      false,
    );
    assert.equal(
      shouldForcePasswordChange({
        mustChangePassword: true,
        planType: "BETA_TESTER",
        email: "chris01ugo@gmail.com",
      }),
      false,
    );
  });
});

describe("isProvisionedOrBetaTesterAccount", () => {
  it("matches invited and beta plan types, not platform admins", () => {
    assert.equal(
      isProvisionedOrBetaTesterAccount({ planType: "INVITED", email: "a@unito.it" }),
      true,
    );
    assert.equal(
      isProvisionedOrBetaTesterAccount({ planType: "BETA_TESTER", email: "b@unito.it" }),
      true,
    );
    assert.equal(
      isProvisionedOrBetaTesterAccount({
        planType: "BETA_TESTER",
        email: "chris01.ugo@gmail.com",
      }),
      false,
    );
  });
});

describe("validateNewPassword", () => {
  it("rejects short or mismatched passwords", () => {
    assert.equal(validateNewPassword("short", "short"), "La nuova password deve avere almeno 8 caratteri.");
    assert.equal(validateNewPassword("nuovapassword", "diversa!!"), "Le password non coincidono.");
  });

  it("accepts a matching password of at least 8 characters", () => {
    assert.equal(validateNewPassword("nuovapassword", "nuovapassword"), null);
  });
});

describe("password-change constants", () => {
  it("keeps the first-login path and API code stable", () => {
    assert.equal(MUST_CHANGE_PASSWORD_PATH, "/account/password");
    assert.equal(MUST_CHANGE_PASSWORD_CODE, "MUST_CHANGE_PASSWORD");
  });
});
