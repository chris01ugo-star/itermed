/**
 * npx tsx --test lib/billing/case-progress.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  displayIdsForStoredCaseId,
  expandLookupIds,
} from "@/lib/billing/case-progress-ids";

describe("displayIdsForStoredCaseId", () => {
  it("matches kebab, upper-case and underscore variants onto the Prassi id", () => {
    const display = ["cardio-001", "pneumo-002", "car-f01"];
    assert.deepEqual(displayIdsForStoredCaseId("CARDIO-001", display), ["cardio-001"]);
    assert.deepEqual(displayIdsForStoredCaseId("cardio_001", display), ["cardio-001"]);
    assert.deepEqual(displayIdsForStoredCaseId("pneumo-002", display), ["pneumo-002"]);
    assert.deepEqual(displayIdsForStoredCaseId("CAR-F01", display), ["car-f01"]);
  });

  it("matches compact ids without hyphens", () => {
    assert.deepEqual(displayIdsForStoredCaseId("carf01", ["car-f01"]), ["car-f01"]);
  });

  it("returns empty when the stored id is a different case", () => {
    assert.deepEqual(displayIdsForStoredCaseId("gastro-001", ["cardio-001"]), []);
  });
});

describe("expandLookupIds", () => {
  it("includes kebab, case, underscore and compact variants", () => {
    const ids = expandLookupIds(["car-f01"]);
    assert.ok(ids.includes("car-f01"));
    assert.ok(ids.includes("CAR-F01"));
    assert.ok(ids.includes("carf01"));
  });
});
