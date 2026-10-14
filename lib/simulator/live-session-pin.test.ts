/**
 * Live session pin: empty React state must not drop a known CaseSession id.
 *
 *   npx tsx --test lib/simulator/live-session-pin.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clearPinnedLiveSessionId,
  pinLiveSessionId,
  resolveAnchoredLiveSessionId,
  resolvePersistedLiveSessionId,
} from "@/lib/simulator/live-session-pin";

describe("live session pin", () => {
  it("returns the pinned id when React state and the ref are empty", () => {
    clearPinnedLiveSessionId("CARDIO-001");
    assert.equal(pinLiveSessionId("CARDIO-001", "clxyz123"), "clxyz123");
    assert.equal(
      resolvePersistedLiveSessionId("CARDIO-001", undefined, null, ""),
      "clxyz123",
    );
    clearPinnedLiveSessionId("CARDIO-001");
  });

  it("prefers the ref over an older sessionStorage pin", () => {
    clearPinnedLiveSessionId("CARDIO-002");
    pinLiveSessionId("CARDIO-002", "cl-old");
    assert.equal(resolveAnchoredLiveSessionId("CARDIO-002", "cl-from-ref"), "cl-from-ref");
    assert.equal(resolveAnchoredLiveSessionId("CARDIO-002", undefined), "cl-old");
    assert.equal(resolvePersistedLiveSessionId("CARDIO-002", "cl-new"), "cl-new");
    clearPinnedLiveSessionId("CARDIO-002");
  });

  it("does not pin offline registry tokens", () => {
    clearPinnedLiveSessionId("CARDIO-003");
    assert.equal(pinLiveSessionId("CARDIO-003", "registry_cardio_abc"), undefined);
    assert.equal(resolvePersistedLiveSessionId("CARDIO-003", undefined), undefined);
  });
});
