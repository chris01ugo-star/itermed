/**
 *   npx tsx --test lib/simulator/chat-context-window.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyPatientChatWindow,
  PATIENT_FULL_HISTORY_TURNS,
  PATIENT_MAX_TURNS,
} from "@/lib/simulator/chat-context-window";
import { buildPatientSystemPrompt } from "@/lib/simulator/patient-system-prompt";

function turns(count: number) {
  return Array.from({ length: count * 2 }, (_, index) => ({
    role: index % 2 === 0 ? ("user" as const) : ("assistant" as const),
    content: `messaggio-${index + 1} sul sintomo`,
  }));
}

describe("patient chat window", () => {
  it("keeps the safety ceiling at 100 clinician turns and the full history through 60", () => {
    assert.equal(PATIENT_MAX_TURNS, 100);
    assert.equal(PATIENT_FULL_HISTORY_TURNS, 60);
  });

  it("sends a 45-turn encounter in full, without speaker brackets", () => {
    const windowed = applyPatientChatWindow(turns(45));
    assert.equal(windowed.messages.length, 90);
    assert.equal(windowed.memorySummary, "");
    assert.match(windowed.messages[0].content, /messaggio-1/);
    assert.match(windowed.messages.at(-1)?.content ?? "", /messaggio-90/);
    assert.equal(windowed.messages.some((message) => message.content.includes("[PAZIENTE]")), false);
  });

  it("after 60 turns keeps the opening, a recall, and the latest 50 turns", () => {
    const windowed = applyPatientChatWindow(turns(70));
    assert.equal(windowed.messages.length, 4 + 100);
    assert.match(windowed.messages[0].content, /messaggio-1/);
    assert.match(windowed.messages.at(-1)?.content ?? "", /messaggio-140/);
    assert.match(windowed.memorySummary, /già stato detto/);
    assert.match(windowed.memorySummary, /messaggio-5/);
  });

  it("leaves a short encounter intact", () => {
    const windowed = applyPatientChatWindow([
      { role: "user", content: "Buongiorno" },
      { role: "assistant", content: "Mi fa male il petto" },
    ]);
    assert.equal(windowed.messages.length, 2);
    assert.match(windowed.messages[0].content, /Buongiorno/);
    assert.equal(windowed.memorySummary, "");
  });

  it("keeps STATO ATTUALE DELLA VISITA on turn 45 and turn 70", () => {
    for (const turn of [45, 70]) {
      const history = applyPatientChatWindow(turns(turn));
      const prompt = buildPatientSystemPrompt({
        patientAge: "58",
        patientSex: "M",
        chiefComplaint: "Dolore al petto",
        clinicalStory: "Dolore al petto da due ore",
        vitalSigns: "{}",
        patientStress: 30,
        trueDiagnosis: "",
        abnormalExams: "",
        clinicalSignsJson: "[]",
        painNrs: null,
        currentTurn: turn,
        completedExamLabels: ["Elettrocardiogramma"],
        proposedTherapies: ["Aspirina"],
        consentCollected: true,
        dialogueMemorySummary: history.memorySummary,
      });
      assert.match(prompt, /STATO ATTUALE DELLA VISITA/);
      assert.match(prompt, /VERITÀ ANAMNESTICA VINCOLANTE/);
      assert.match(prompt, new RegExp(`Turno del medico: ${turn}`));
      assert.match(prompt, /Elettrocardiogramma/);
      assert.match(prompt, /Aspirina/);
      assert.match(prompt, /te lo hanno spiegato/);
      if (turn === 70) assert.match(prompt, /già stato detto/);
    }
  });
});
