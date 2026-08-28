/**
 * Determinism proof for the D-RIME FSM.
 *
 *   npx tsx --test lib/services/d-rime-fsm.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LLM_INTENT_CONFIDENCE_THRESHOLD,
  STANDARD_INTENT_DELTAS,
  applyIntentSequence,
  clampAffectState,
  selectTurnIntents,
  transitionAffectState,
  type DoctorIntentCategory,
  type PatientAffectState,
} from "@/lib/services/d-rime-fsm";
import { evaluateInteractionTrajectory } from "@/lib/reports/d-rime-engine";

const SEQUENCE: DoctorIntentCategory[] = [
  "VALIDATION",
  "EMPATHIC_EXPLORATION",
  "CLINICAL_DISCLOSURE",
  "PATERNALISTIC_COMMAND",
  "DEFENSIVE_REACTION",
  "DISCORDANCE",
  "NEUTRAL",
];

const INITIAL: PatientAffectState = { trust: 50, anxiety: 50, defensiveness: 50 };

function expectedAfterSequence(start: PatientAffectState, intents: DoctorIntentCategory[]): PatientAffectState {
  let state = clampAffectState(start);
  for (const intent of intents) {
    const d = STANDARD_INTENT_DELTAS[intent];
    state = clampAffectState({
      trust: state.trust + d.trust,
      anxiety: state.anxiety + d.anxiety,
      defensiveness: state.defensiveness + d.defensiveness,
    });
  }
  return state;
}

describe("d-rime-fsm determinism", () => {
  it("produces identical numeric output for the same intent sequence", () => {
    const a = applyIntentSequence(INITIAL, SEQUENCE, "standard");
    const b = applyIntentSequence(INITIAL, SEQUENCE, "standard");
    assert.deepEqual(a.final, b.final);
    assert.equal(JSON.stringify(a), JSON.stringify(b));
  });

  it("matches the frozen delta table exactly (hand-computed golden path)", () => {
    const golden = expectedAfterSequence(INITIAL, SEQUENCE);
    const { final, steps } = applyIntentSequence(INITIAL, SEQUENCE, "standard");
    assert.deepEqual(final, golden);
    assert.equal(steps.length, SEQUENCE.length);
    assert.deepEqual(final, { trust: 58, anxiety: 36, defensiveness: 57 });
  });

  it("clamps Trust / Anxiety / Defensiveness to [0, 100] at every single step", () => {
    const low = transitionAffectState({ trust: 5, anxiety: 95, defensiveness: 95 }, "PATERNALISTIC_COMMAND");
    assert.equal(low.next.trust, 0);
    assert.equal(low.next.anxiety, 100);
    assert.equal(low.next.defensiveness, 100);
    assert.ok(low.previous.trust >= 0 && low.previous.trust <= 100);
    assert.ok(low.previous.anxiety >= 0 && low.previous.anxiety <= 100);

    const high = transitionAffectState({ trust: 98, anxiety: 2, defensiveness: 2 }, "VALIDATION");
    assert.equal(high.next.trust, 100);
    assert.equal(high.next.anxiety, 0);
    assert.equal(high.next.defensiveness, 0);

    const dirtyIn = transitionAffectState(
      { trust: -40, anxiety: 150, defensiveness: 999 },
      "NEUTRAL",
    );
    assert.deepEqual(dirtyIn.previous, { trust: 0, anxiety: 100, defensiveness: 100 });
    assert.deepEqual(dirtyIn.next, { trust: 0, anxiety: 100, defensiveness: 100 });

    let state: PatientAffectState = { trust: 8, anxiety: 92, defensiveness: 90 };
    for (let i = 0; i < 12; i += 1) {
      const step = transitionAffectState(state, "PATERNALISTIC_COMMAND");
      for (const axis of [step.previous, step.next] as const) {
        assert.ok(axis.trust >= 0 && axis.trust <= 100, `trust out of range at step ${i}`);
        assert.ok(axis.anxiety >= 0 && axis.anxiety <= 100, `anxiety out of range at step ${i}`);
        assert.ok(axis.defensiveness >= 0 && axis.defensiveness <= 100, `defensiveness out of range at step ${i}`);
      }
      state = step.next;
    }
    const sequence = applyIntentSequence(
      { trust: 8, anxiety: 92, defensiveness: 90 },
      Array.from({ length: 12 }, () => "PATERNALISTIC_COMMAND" as const),
    );
    for (const step of sequence.steps) {
      assert.ok(step.next.trust >= 0 && step.next.trust <= 100);
      assert.ok(step.next.anxiety >= 0 && step.next.anxiety <= 100);
      assert.ok(step.next.defensiveness >= 0 && step.next.defensiveness <= 100);
    }
  });

  it("evaluateInteractionTrajectory is deterministic given the same classified intents", () => {
    const chat = [
      { role: "assistant", content: "Ho paura, ho letto su internet che è un tumore." },
      { role: "user", content: "Capisco la sua preoccupazione." },
      { role: "user", content: "Le spiego in parole semplici il prossimo passo." },
    ];
    const classified = [
      {
        turnIndex: 0,
        utteranceExcerpt: "Capisco la sua preoccupazione.",
        intents: [{ category: "VALIDATION" as const, confidence: 0.92, explanation: "legittimazione" }],
      },
      {
        turnIndex: 1,
        utteranceExcerpt: "Le spiego in parole semplici il prossimo passo.",
        intents: [
          { category: "CLINICAL_DISCLOSURE" as const, confidence: 0.88, explanation: "SPIKES-Knowledge" },
        ],
      },
    ];
    const first = evaluateInteractionTrajectory(chat, null, null, { classifiedIntents: classified });
    const second = evaluateInteractionTrajectory(chat, null, null, { classifiedIntents: classified });
    assert.equal(JSON.stringify(first.finalState), JSON.stringify(second.finalState));
    assert.equal(first.score, second.score);
    assert.equal(first.careTrustScore, second.careTrustScore);
    assert.equal(first.spikesEmpathyScore, second.spikesEmpathyScore);
    assert.equal(first.riasAlignmentScore, second.riasAlignmentScore);
    assert.deepEqual(first.trajectory.map((s) => s.state), second.trajectory.map((s) => s.state));
  });

  it("rejects LLM intents below the 0.60 confidence floor (lexical / NEUTRAL fallback)", () => {
    assert.equal(LLM_INTENT_CONFIDENCE_THRESHOLD, 0.6);
    const lowConf = selectTurnIntents(
      [{ category: "PATERNALISTIC_COMMAND", confidence: 0.41, explanation: "incerto" }],
      "NEUTRAL",
    );
    assert.deepEqual(lowConf, ["NEUTRAL"]);

    const missingConf = selectTurnIntents(
      [{ category: "VALIDATION", confidence: Number.NaN, explanation: "n/a" }],
      "NEUTRAL",
    );
    assert.deepEqual(missingConf, ["NEUTRAL"]);

    const accepted = selectTurnIntents(
      [{ category: "VALIDATION", confidence: 0.6, explanation: "soglia inclusa" }],
      "NEUTRAL",
    );
    assert.deepEqual(accepted, ["VALIDATION"]);

    const ambiguous = selectTurnIntents(
      [
        { category: "PATERNALISTIC_COMMAND", confidence: 0.72, explanation: "tono" },
        { category: "VALIDATION", confidence: 0.71, explanation: "capisco" },
      ],
      "NEUTRAL",
    );
    assert.deepEqual(ambiguous, ["NEUTRAL"]);
  });

  it("does not apply marked FSM deltas for a low-confidence paternalistic label", () => {
    const chat = [
      { role: "user", content: "Procediamo con gli esami di routine." },
    ];
    const classified = [
      {
        turnIndex: 0,
        utteranceExcerpt: "Procediamo con gli esami di routine.",
        intents: [
          { category: "PATERNALISTIC_COMMAND" as const, confidence: 0.38, explanation: "bassa confidenza" },
        ],
      },
    ];
    const result = evaluateInteractionTrajectory(chat, null, null, { classifiedIntents: classified });
    assert.deepEqual(result.finalState, result.initialState);
    assert.deepEqual(result.acts[0]?.intents, ["NEUTRAL"]);
    assert.deepEqual(STANDARD_INTENT_DELTAS.NEUTRAL, { trust: 0, anxiety: 0, defensiveness: 0 });
  });
});
