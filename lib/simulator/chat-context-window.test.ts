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
  it("caps the LLM window at the opening pair plus the latest 24 messages", () => {
    assert.equal(PATIENT_MAX_TURNS, 35);
    assert.equal(PATIENT_CHAT_WINDOW_SIZE, 26);
  });

  it("keeps the opening pair and the latest 24 messages", () => {
    const messages = Array.from({ length: 70 }, (_, i) => ({
      role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: `turn-${i + 1}`,
    }));
    const windowed = applyPatientChatWindow(messages);
    assert.equal(windowed.length, 26);
    assert.match(windowed[0].content, /turn-1/);
    assert.match(windowed[1].content, /turn-2/);
    assert.match(windowed[2].content, /turn-47/);
    assert.match(windowed[25].content, /turn-70/);
  });

  it("leaves a short encounter intact", () => {
    const messages = [
      { role: "user" as const, content: "Buongiorno" },
      { role: "assistant" as const, content: "Mi fa male" },
    ];
    const windowed = applyPatientChatWindow(messages);
    assert.equal(windowed.length, 2);
    assert.match(windowed[0].content, /Buongiorno/);
  });
});
