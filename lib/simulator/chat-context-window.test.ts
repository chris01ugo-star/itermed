/**
 *   npx tsx --test lib/simulator/chat-context-window.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyPatientChatWindow,
  PATIENT_CHAT_WINDOW_SIZE,
  PATIENT_MAX_TURNS,
} from "@/lib/simulator/chat-context-window";

describe("patient chat window", () => {
  it("caps clinician turns at 35 and retains the full dialogue", () => {
    assert.equal(PATIENT_MAX_TURNS, 35);
    assert.equal(PATIENT_CHAT_WINDOW_SIZE, 70);
  });

  it("keeps 35 user turns in the LLM window", () => {
    const messages = Array.from({ length: 70 }, (_, i) => ({
      role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: `turn-${i + 1}`,
    }));
    const windowed = applyPatientChatWindow(messages);
    assert.equal(windowed.length, 70);
    assert.match(windowed[0].content, /turn-1/);
    assert.match(windowed[69].content, /turn-70/);
  });
});
