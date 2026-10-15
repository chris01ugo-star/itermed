/**
 * npx tsx --test lib/auth/must-change-password.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MUST_CHANGE_PASSWORD_CODE,
  MUST_CHANGE_PASSWORD_PATH,
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

  it("lets existing accounts through", () => {
    assert.equal(
      shouldForcePasswordChange({
        mustChangePassword: false,
        email: "studente@unito.it",
      }),
      false,
    );
    assert.equal(
      shouldForcePasswordChange({
        mustChangePassword: undefined,
        email: "studente@unito.it",
      }),
      false,
    );
  });

  it("never blocks platform admins", () => {
    assert.equal(
      shouldForcePasswordChange({
        mustChangePassword: true,
        email: "dariobarbagallo46@gmail.com",
      }),
      false,
    );
    assert.equal(
      shouldForcePasswordChange({
        mustChangePassword: true,
        email: "chris01ugo@gmail.com",
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
