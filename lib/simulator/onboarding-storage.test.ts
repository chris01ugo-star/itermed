import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  AEQUAN_LAB_TUTORIAL_SEEN_V1,
  AEQUAN_TUTORIAL_SEEN_V2,
  hasSeenLabSimulatorTutorial,
  hasSeenSimulatorTutorial,
  markLabSimulatorTutorialSeen,
  markSimulatorTutorialSeen,
} from "@/lib/simulator/onboarding-storage";

type Store = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

const originalWindow = globalThis.window;

afterEach(() => {
  if (originalWindow === undefined) {
    // @ts-expect-error test teardown for a non-browser runner
    delete globalThis.window;
  } else {
    globalThis.window = originalWindow;
  }
});

function installStorage(store: Store) {
  globalThis.window = { localStorage: store } as unknown as Window & typeof globalThis;
}

describe("simulator tutorial storage", () => {
  it("stays closed during SSR", () => {
    // @ts-expect-error simulate the server render
    delete globalThis.window;
    assert.equal(hasSeenSimulatorTutorial(), true);
    markSimulatorTutorialSeen();
    assert.equal(hasSeenSimulatorTutorial(), true);
  });

  it("opens on the first interaction and stays closed after it is marked", () => {
    const memory = new Map<string, string>();
    installStorage({
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => {
        memory.set(key, value);
      },
    });

    assert.equal(hasSeenSimulatorTutorial(), false);
    markSimulatorTutorialSeen();
    assert.equal(memory.get(AEQUAN_TUTORIAL_SEEN_V2), "true");
    assert.equal(hasSeenSimulatorTutorial(), true);
    assert.equal(memory.has("AEQUAN_CASE_TOUR_TUTORIAL_001"), false);
    assert.equal(memory.has("AEQUAN_TUTORIAL_COMPLETED_V1"), false);
  });

  it("keeps the laboratory guide separate from the clinical guide", () => {
    const memory = new Map<string, string>();
    installStorage({
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => {
        memory.set(key, value);
      },
    });

    assert.equal(hasSeenSimulatorTutorial(), false);
    assert.equal(hasSeenLabSimulatorTutorial(), false);
    markSimulatorTutorialSeen();
    assert.equal(hasSeenLabSimulatorTutorial(), false);
    assert.equal(memory.has(AEQUAN_LAB_TUTORIAL_SEEN_V1), false);
    markLabSimulatorTutorialSeen();
    assert.equal(memory.get(AEQUAN_LAB_TUTORIAL_SEEN_V1), "true");
    assert.equal(hasSeenSimulatorTutorial(), true);
    assert.equal(hasSeenLabSimulatorTutorial(), true);
  });

  it("treats a blocked localStorage as already seen", () => {
    installStorage({
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    assert.equal(hasSeenSimulatorTutorial(), true);
    assert.doesNotThrow(() => markSimulatorTutorialSeen());
  });
});
