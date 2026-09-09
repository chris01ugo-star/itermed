/**
 * Standalone determinism check for the D-RIME FSM (no test runner required).
 *
 *   npx tsx scripts/verify-d-rime-fsm.ts
 */
import {
  STANDARD_INTENT_DELTAS,
  applyIntentSequence,
  type DoctorIntentCategory,
  type PatientAffectState,
} from "@/lib/services/d-rime-fsm";

const SEQUENCE: DoctorIntentCategory[] = [
  "VALIDATION",
  "EMPATHIC_EXPLORATION",
  "CLINICAL_DISCLOSURE",
  "PATERNALISTIC_COMMAND",
  "DISCORDANCE",
];

const INITIAL: PatientAffectState = { trust: 50, anxiety: 50, defensiveness: 50 };

function fail(message: string): never {
  console.error(`[verify-d-rime-fsm] FAIL: ${message}`);
  process.exit(1);
}

const runA = applyIntentSequence(INITIAL, SEQUENCE, "standard");
const runB = applyIntentSequence(INITIAL, SEQUENCE, "standard");

if (JSON.stringify(runA) !== JSON.stringify(runB)) {
  fail("same intent sequence produced different FSM output");
}

let expected: PatientAffectState = { ...INITIAL };
for (const intent of SEQUENCE) {
  const d = STANDARD_INTENT_DELTAS[intent];
  expected = {
    trust: Math.max(0, Math.min(100, expected.trust + d.trust)),
    anxiety: Math.max(0, Math.min(100, expected.anxiety + d.anxiety)),
    defensiveness: Math.max(0, Math.min(100, expected.defensiveness + d.defensiveness)),
  };
}

if (JSON.stringify(runA.final) !== JSON.stringify(expected)) {
  fail(`golden mismatch: got ${JSON.stringify(runA.final)} expected ${JSON.stringify(expected)}`);
}

console.log("[verify-d-rime-fsm] PASS — identical output for identical intent sequence");
console.log(JSON.stringify({ sequence: SEQUENCE, final: runA.final }, null, 2));
