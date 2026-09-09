/**
 * API auth guards: JWT 401 shape, teacher/admin role split, IDOR session tokens.
 *
 *   npx tsx --test lib/security/api-auth-guards.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { unauthorizedJson, forbiddenJson } from "@/lib/api-session";
import { isTeacherRole } from "@/lib/cases/require-teacher-api";
import { isOfflineSessionId, sanitizeLiveSessionId } from "@/lib/simulator/session-id";

describe("unauthorizedJson", () => {
  it("returns HTTP 401 with code UNAUTHORIZED", async () => {
    const res = unauthorizedJson();
    assert.equal(res.status, 401);
    const body = (await res.json()) as { error: string; code: string };
    assert.equal(body.code, "UNAUTHORIZED");
  });
});

describe("forbiddenJson", () => {
  it("returns HTTP 403 with FORBIDDEN_ROLE for reserved resources", async () => {
    const res = forbiddenJson("Forbidden", "FORBIDDEN_ROLE");
    assert.equal(res.status, 403);
    const body = (await res.json()) as { error: string; code: string };
    assert.equal(body.code, "FORBIDDEN_ROLE");
  });
});

describe("isTeacherRole", () => {
  it("allows INSTRUCTOR and ADMIN only", () => {
    assert.equal(isTeacherRole("INSTRUCTOR"), true);
    assert.equal(isTeacherRole("ADMIN"), true);
    assert.equal(isTeacherRole("STUDENT"), false);
    assert.equal(isTeacherRole(""), false);
  });
});

describe("live session tokens (IDOR)", () => {
  it("does not treat registry/offline tokens as owned CaseSession ids", () => {
    assert.equal(isOfflineSessionId("registry_cardio-nstemi_abc"), true);
    assert.equal(sanitizeLiveSessionId("registry_cardio-nstemi_abc"), undefined);
    assert.equal(sanitizeLiveSessionId(""), undefined);
    assert.equal(sanitizeLiveSessionId("clxyz123"), "clxyz123");
  });
});
