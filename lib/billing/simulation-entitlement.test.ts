/**
 * npx tsx --test lib/billing/simulation-entitlement.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ACCOUNT_DISABLED_CODE,
  effectiveEditableLimit,
  nextStoredFreeSimulationLimit,
  resolveSimulationEntitlement,
  UNLIMITED_SIMULATION_SENTINEL,
} from "@/lib/billing/simulation-entitlement";
import { SPONSORED_FREE_CASE_LIMIT } from "@/lib/billing/unlimited-case-access";
import { PILOT_SIMULATION_CAP } from "@/lib/pilot-whitelist";

describe("resolveSimulationEntitlement", () => {
  it("disables an inactive account before any other privilege", () => {
    const entitlement = resolveSimulationEntitlement({
      isActive: false,
      role: "ADMIN",
      email: "chris01.ugo@gmail.com",
      freeSimulationLimit: UNLIMITED_SIMULATION_SENTINEL,
    });
    assert.equal(entitlement.isActive, false);
    assert.equal(entitlement.kind, "disabled");
    assert.equal(entitlement.lifetimeLimit, 0);
  });

  it("keeps ADMIN unlimited when active", () => {
    const entitlement = resolveSimulationEntitlement({
      isActive: true,
      role: "ADMIN",
      email: "admin@example.com",
    });
    assert.equal(entitlement.unlimited, true);
    assert.equal(entitlement.source, "admin");
  });

  it("uses the admin override for a pilot tester", () => {
    const entitlement = resolveSimulationEntitlement({
      isActive: true,
      role: "STUDENT",
      email: "ariannaallegretti2003@gmail.com",
      freeSimulationLimit: 12,
    });
    assert.equal(entitlement.kind, "lifetime");
    assert.equal(entitlement.source, "override");
    assert.equal(entitlement.lifetimeLimit, 12);
  });

  it("treats -1 override as unlimited", () => {
    const entitlement = resolveSimulationEntitlement({
      isActive: true,
      role: "STUDENT",
      email: "ariannaallegretti2003@gmail.com",
      freeSimulationLimit: UNLIMITED_SIMULATION_SENTINEL,
    });
    assert.equal(entitlement.unlimited, true);
    assert.equal(entitlement.source, "override");
  });

  it("falls back to sponsored 20 and pilot 3", () => {
    assert.equal(
      resolveSimulationEntitlement({
        isActive: true,
        role: "STUDENT",
        email: "federico.frusone@gmail.com",
      }).lifetimeLimit,
      SPONSORED_FREE_CASE_LIMIT,
    );
    assert.equal(
      resolveSimulationEntitlement({
        isActive: true,
        role: "STUDENT",
        email: "ariannaallegretti2003@gmail.com",
      }).lifetimeLimit,
      PILOT_SIMULATION_CAP,
    );
  });
});

describe("admin stepper", () => {
  it("starts from the default cap and increments / decrements", () => {
    assert.equal(
      effectiveEditableLimit({
        isActive: true,
        role: "STUDENT",
        email: "ariannaallegretti2003@gmail.com",
      }),
      3,
    );
    assert.equal(nextStoredFreeSimulationLimit(3, 1), 4);
    assert.equal(nextStoredFreeSimulationLimit(3, -1), 2);
    assert.equal(nextStoredFreeSimulationLimit(0, -1), 0);
    assert.equal(nextStoredFreeSimulationLimit("unlimited", -1), 2);
    assert.equal(nextStoredFreeSimulationLimit("unlimited", 1), UNLIMITED_SIMULATION_SENTINEL);
  });
});

describe("account disabled code", () => {
  it("exports a stable login error code", () => {
    assert.equal(ACCOUNT_DISABLED_CODE, "ACCOUNT_DISABLED");
  });
});
