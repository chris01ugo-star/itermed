import { computeTotalScoreTrentesimi, type DimensionScores } from "@/lib/services/evaluation-scoring";
import type { LabCaseBlueprint, LabWorkbenchState } from "@/lib/simulator/laboratory-workbench";

/**
 * Voto del banco LIS. Usa solo i pesi /30 di Aequan.
 * Non applica referto clinico invalido, diario di dimissione, esame obiettivo né stress.
 */
export const LAB_ASYNC_CHANNEL_PENALTY = 45;
export const LAB_MISSING_READBACK_PENALTY = 30;
export const LAB_MISSING_NOTIFICATION_PENALTY = 70;
export const LAB_SLA_PENALTY = 20;
export const LAB_FALSE_ALARM_PENALTY = 40;
export const LAB_INAPPROPRIATE_REFLEX_POINTS = 25;
export const LAB_OVERRUN_PENALTY_CAP = 70;
export const LAB_INAPPROPRIATE_ECONOMY_POINTS = 15;
export const LAB_INAPPROPRIATE_ECONOMY_CAP = 30;

export type LabWaterfallKind = "base" | "bonus" | "penalty" | "cap" | "final";

export type LabWaterfallStep = {
  label: string;
  delta: number;
  valueAfter: number;
  detail: string;
  kind: LabWaterfallKind;
};

export type LabScoreWaterfall = Record<keyof DimensionScores, LabWaterfallStep[]>;

export type FiredLabKiller = {
  id: string;
  label: string;
  maxScoreCap: number;
};

export type LabSessionGrade = {
  scores: DimensionScores;
  waterfall: LabScoreWaterfall;
  rawTrentesimi: number;
  totalTrentesimi: number;
  killerSwitchApplied: boolean;
  killerCap: number | null;
  firedKillers: FiredLabKiller[];
  fatalErrors: Array<{ description: string; rationale: string }>;
  reflexSpendEuro: number;
  inappropriateSpendEuro: number;
  clinicalPenaltiesApplied: {
    invalidClinicalReport: false;
    dischargeDiaryMalus: false;
    physicalExamMalus: false;
    hiddenStressMalus: false;
  };
};

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function push(
  steps: LabWaterfallStep[],
  label: string,
  before: number,
  after: number,
  kind: LabWaterfallKind,
  detail: string,
): number {
  const valueAfter = clamp(after);
  steps.push({
    label,
    delta: round1(valueAfter - before),
    valueAfter,
    detail,
    kind,
  });
  return valueAfter;
}

function finish(steps: LabWaterfallStep[], score: number): void {
  steps.push({
    label: "Voto finale",
    delta: 0,
    valueAfter: score,
    detail: `${score}/100 sul pilastro del banco.`,
    kind: "final",
  });
}

/**
 * Confronto esatto del codice motivo. Vale anche per i codici di scuola
 * CQI_WESTGARD, POCT_DISCORDANTE, CONFERMA_PENDENTE, INCOMPATIBILITA_TRASFUSIONALE
 * e INTERFERENZA_FARMACO: non esistono sinonimi che diano credito pieno.
 */
function sameCode(left: string | undefined, right: string): boolean {
  return (left ?? "").trim().toUpperCase() === right.trim().toUpperCase();
}

function dispositionCredit(blueprint: LabCaseBlueprint, state: LabWorkbenchState): number {
  const rows: number[] = blueprint.analytes.map((analyte) => {
    const decision = state.dispositions[analyte.id];
    if (!decision) return 0;
    if (decision.action !== analyte.expectedDisposition) return 0;
    if (!analyte.expectedReasonCode || decision.action === "VALIDATE") return 1;
    return sameCode(decision.reasonCode, analyte.expectedReasonCode) ? 1 : 0.5;
  });
  if (rows.length === 0) return 100;
  return (rows.reduce((sum, row) => sum + row, 0) / rows.length) * 100;
}

function investigationCredit(blueprint: LabCaseBlueprint, state: LabWorkbenchState): number {
  const required = blueprint.evaluation.requiredInvestigations;
  if (required.length === 0) return 100;
  const unlocked = new Set(state.unlockedInvestigations.map((row) => row.id));
  const hits = required.filter((id) => unlocked.has(id)).length;
  return (hits / required.length) * 100;
}

function orderedIds(state: LabWorkbenchState): Set<string> {
  return new Set(state.requestedReflexIds.map((row) => row.id));
}

export function firedLabKillers(
  blueprint: LabCaseBlueprint,
  state: LabWorkbenchState,
): FiredLabKiller[] {
  const ordered = orderedIds(state);
  const fired: FiredLabKiller[] = [];
  for (const rule of blueprint.evaluation.killerSwitches) {
    const trigger = rule.trigger;
    let hit = false;
    if (trigger.kind === "VALIDATE_UNRELIABLE_ANALYTE") {
      const analyte = blueprint.analytes.find((item) => item.id === trigger.analyteId);
      const decision = state.dispositions[trigger.analyteId];
      const reasonOk =
        !trigger.whenReasonCodes?.length ||
        trigger.whenReasonCodes.some(
          (code) =>
            sameCode(analyte?.expectedReasonCode, code) || sameCode(decision?.reasonCode, code),
        );
      hit = Boolean(
        analyte && decision?.action === "VALIDATE" && analyte.expectedDisposition !== "VALIDATE" && reasonOk,
      );
    } else if (trigger.kind === "OMIT_SYNCHRONOUS_CRITICAL_CALL") {
      const policy = blueprint.criticalValuePolicy;
      const notice = state.criticalNotification;
      const phone = notice?.sent === true && notice.channel === "PHONE";
      const readBackOk = !policy.requiresReadBack || notice?.readBackConfirmed === true;
      hit = policy.required && policy.mustUseSynchronousPhone && (!phone || !readBackOk);
    } else if (trigger.kind === "ACCEPT_PHONE_RELABEL") {
      const analytes = blueprint.analytes.filter((analyte) =>
        trigger.analyteId ? analyte.id === trigger.analyteId : sameCode(analyte.expectedReasonCode, "WBIT"),
      );
      hit = analytes.some((analyte) => state.dispositions[analyte.id]?.action === "VALIDATE");
    } else {
      hit = ordered.has(trigger.reflexId);
    }
    if (hit) {
      fired.push({ id: rule.id, label: rule.label, maxScoreCap: rule.maxScoreCap });
    }
  }
  return fired;
}

function gradeRigour(blueprint: LabCaseBlueprint, state: LabWorkbenchState): {
  score: number;
  steps: LabWaterfallStep[];
} {
  const steps: LabWaterfallStep[] = [];
  const investigations = investigationCredit(blueprint, state);
  const dispositions = dispositionCredit(blueprint, state);
  let score = push(
    steps,
    "Indagini di banco",
    0,
    investigations,
    "base",
    blueprint.evaluation.requiredInvestigations.length === 0
      ? "Nessuna indagine obbligatoria su questo ticket."
      : "Copertura delle indagini richieste prima della firma.",
  );
  score = push(
    steps,
    "Disposizioni analitiche",
    score,
    investigations * 0.4 + dispositions * 0.6,
    dispositions >= 99 ? "bonus" : "penalty",
    "Azione attesa per ogni analita e codice di non idoneità, quando previsto.",
  );
  finish(steps, score);
  return { score, steps };
}

function gradeReflex(blueprint: LabCaseBlueprint, state: LabWorkbenchState): {
  score: number;
  steps: LabWaterfallStep[];
} {
  const steps: LabWaterfallStep[] = [];
  const ordered = orderedIds(state);
  const mandatory = blueprint.reflexCatalog.filter((item) => item.expectedAction === "MANDATORY");
  const hits = mandatory.filter((item) => ordered.has(item.id)).length;
  const base = mandatory.length === 0 ? 100 : (hits / mandatory.length) * 100;
  let score = push(
    steps,
    "Reflex obbligatori",
    0,
    base,
    "base",
    mandatory.length === 0
      ? "Nessun reflex obbligatorio."
      : `${hits}/${mandatory.length} reflex obbligatori eseguiti.`,
  );
  const inappropriate = blueprint.reflexCatalog.filter(
    (item) => item.expectedAction === "INAPPROPRIATE" && ordered.has(item.id),
  );
  if (inappropriate.length > 0) {
    score = push(
      steps,
      "Reflex inappropriati",
      score,
      score - inappropriate.length * LAB_INAPPROPRIATE_REFLEX_POINTS,
      "penalty",
      inappropriate.map((item) => item.name).join(", "),
    );
  }
  finish(steps, score);
  return { score, steps };
}

function gradeLegal(blueprint: LabCaseBlueprint, state: LabWorkbenchState): {
  score: number;
  steps: LabWaterfallStep[];
} {
  const steps: LabWaterfallStep[] = [];
  const policy = blueprint.criticalValuePolicy;
  const notice = state.criticalNotification;
  let score = push(
    steps,
    "Policy del valore critico",
    0,
    100,
    "base",
    policy.required
      ? "Il caso richiede una notifica critica documentata."
      : "Il numero non è un valore critico da notificare.",
  );
  if (!policy.required) {
    if (notice?.sent && notice.channel !== "NONE") {
      score = push(
        steps,
        "Falso allarme",
        score,
        score - LAB_FALSE_ALARM_PENALTY,
        "penalty",
        "Notifica inviata su un risultato che la policy non classifica come critico.",
      );
    }
  } else if (!notice?.sent || notice.channel === "NONE") {
    score = push(
      steps,
      "Notifica critica assente",
      score,
      score - LAB_MISSING_NOTIFICATION_PENALTY,
      "penalty",
      "Manca la comunicazione del valore critico.",
    );
  } else {
    if (policy.mustUseSynchronousPhone && notice.channel !== "PHONE") {
      score = push(
        steps,
        "Canale non sincrono",
        score,
        score - LAB_ASYNC_CHANNEL_PENALTY,
        "penalty",
        `${notice.channel} non sostituisce la telefonata. Fax, email e segreteria non chiudono il critico.`,
      );
    }
    if (policy.requiresReadBack && !notice.readBackConfirmed) {
      score = push(
        steps,
        "Read-back assente",
        score,
        score - LAB_MISSING_READBACK_PENALTY,
        "penalty",
        "Manca il read-back di identità, valore e unità.",
      );
    }
    const elapsed = notice.elapsedMinutes;
    if (elapsed == null || elapsed > policy.slaMinutes) {
      score = push(
        steps,
        "SLA della notifica",
        score,
        score - LAB_SLA_PENALTY,
        "penalty",
        `La notifica deve arrivare entro ${policy.slaMinutes} minuti.`,
      );
    }
  }
  finish(steps, score);
  return { score, steps };
}

function gradeEconomy(blueprint: LabCaseBlueprint, state: LabWorkbenchState): {
  score: number;
  steps: LabWaterfallStep[];
  inappropriateSpendEuro: number;
} {
  const steps: LabWaterfallStep[] = [];
  const spent = state.reflexSpendEuro;
  const budget = blueprint.budgetEuro;
  const ordered = orderedIds(state);
  const inappropriateSpendEuro = blueprint.reflexCatalog
    .filter((item) => item.expectedAction === "INAPPROPRIATE" && ordered.has(item.id))
    .reduce((sum, item) => sum + item.costEuro, 0);
  let score = push(
    steps,
    "Budget reflex",
    0,
    100,
    "base",
    `Budget ${budget.toFixed(2)} €, spesi ${spent.toFixed(2)} €.`,
  );
  const overrunEuro = Math.max(0, spent - budget);
  if (overrunEuro > 0 && budget > 0) {
    const penalty = Math.min(LAB_OVERRUN_PENALTY_CAP, Math.round((overrunEuro / budget) * LAB_OVERRUN_PENALTY_CAP));
    score = push(
      steps,
      "Sforamento budget SSN",
      score,
      score - penalty,
      "penalty",
      `Sforamento ${overrunEuro.toFixed(2)} € sul budget di ${budget.toFixed(2)} €.`,
    );
  } else if (overrunEuro > 0) {
    score = push(
      steps,
      "Sforamento budget SSN",
      score,
      score - LAB_OVERRUN_PENALTY_CAP,
      "penalty",
      "Spesa reflex con budget zero.",
    );
  }
  const inappropriateCount = blueprint.reflexCatalog.filter(
    (item) => item.expectedAction === "INAPPROPRIATE" && ordered.has(item.id),
  ).length;
  if (inappropriateCount > 0) {
    const penalty = Math.min(
      LAB_INAPPROPRIATE_ECONOMY_CAP,
      inappropriateCount * LAB_INAPPROPRIATE_ECONOMY_POINTS,
    );
    score = push(
      steps,
      "Costo dei reflex inappropriati",
      score,
      score - penalty,
      "penalty",
      `${inappropriateSpendEuro.toFixed(2)} € su reflex non indicati.`,
    );
  }
  finish(steps, score);
  return { score, steps, inappropriateSpendEuro: Math.round(inappropriateSpendEuro * 100) / 100 };
}

function noteHasConcept(note: string, concept: string): boolean {
  return note.toLowerCase().includes(concept.trim().toLowerCase());
}

export function deterministicCommunicationScore(
  blueprint: LabCaseBlueprint,
  state: LabWorkbenchState,
): number {
  const note = state.validationNote.trim();
  const lengthPoints = note.length >= 25 ? 40 : note.length >= 10 ? 15 : 0;
  const concepts = blueprint.evaluation.expectedValidationNoteConcepts;
  const hits = concepts.filter((concept) => noteHasConcept(note, concept)).length;
  const conceptPoints = concepts.length === 0 ? 40 : Math.round((40 * hits) / concepts.length);
  const hasUser = state.interprofessionalLog.some((row) => row.role === "user");
  const hasCounterpart = state.interprofessionalLog.some(
    (row) => row.role === "tslb" || row.role === "clinician",
  );
  const logPoints = hasUser && hasCounterpart ? 20 : state.interprofessionalLog.length > 0 ? 10 : 0;
  return clamp(lengthPoints + conceptPoints + logPoints);
}

function gradeCommunication(
  blueprint: LabCaseBlueprint,
  state: LabWorkbenchState,
  qualitative: number | null,
): { score: number; steps: LabWaterfallStep[] } {
  const steps: LabWaterfallStep[] = [];
  const base = deterministicCommunicationScore(blueprint, state);
  let score = push(
    steps,
    "Nota e dialogo",
    0,
    base,
    "base",
    "Lunghezza della nota, concetti attesi e traccia del dialogo col reparto.",
  );
  if (qualitative != null) {
    score = push(
      steps,
      "Raffinamento della nota",
      score,
      base * 0.6 + qualitative * 0.4,
      "bonus",
      "Il voto qualitativo pesa il 40% e non sostituisce la base deterministica.",
    );
  }
  finish(steps, score);
  return { score, steps };
}

function applyKillerCap(
  steps: LabWaterfallStep[],
  score: number,
  fired: FiredLabKiller[],
): number {
  if (fired.length === 0) return score;
  const cap = Math.min(...fired.map((rule) => rule.maxScoreCap));
  const withoutFinal = steps.filter((step) => step.kind !== "final");
  steps.length = 0;
  steps.push(...withoutFinal);
  push(
    steps,
    "Killer switch",
    score,
    score,
    "cap",
    `${fired.map((rule) => rule.label).join("; ")}. Tetto ${cap}/30 sul voto finale.`,
  );
  finish(steps, score);
  return score;
}

export function gradeLaboratorySession(input: {
  blueprint: LabCaseBlueprint;
  state: LabWorkbenchState;
  qualitativeCommunicationScore?: number | null;
}): LabSessionGrade {
  const qualitative =
    input.qualitativeCommunicationScore == null || !Number.isFinite(input.qualitativeCommunicationScore)
      ? null
      : clamp(input.qualitativeCommunicationScore);
  const rigour = gradeRigour(input.blueprint, input.state);
  const reflex = gradeReflex(input.blueprint, input.state);
  const legal = gradeLegal(input.blueprint, input.state);
  const economy = gradeEconomy(input.blueprint, input.state);
  const communication = gradeCommunication(input.blueprint, input.state, qualitative);
  const fired = firedLabKillers(input.blueprint, input.state);
  applyKillerCap(legal.steps, legal.score, fired);

  const scores: DimensionScores = {
    clinical: rigour.score,
    exams: reflex.score,
    legal: legal.score,
    economy: economy.score,
    empathy: communication.score,
  };
  const rawTrentesimi = computeTotalScoreTrentesimi(scores);
  const killerCap = fired.length === 0 ? null : Math.min(...fired.map((rule) => rule.maxScoreCap));
  const totalTrentesimi = killerCap == null ? rawTrentesimi : Math.min(rawTrentesimi, killerCap);

  return {
    scores,
    waterfall: {
      clinical: rigour.steps,
      exams: reflex.steps,
      legal: legal.steps,
      economy: economy.steps,
      empathy: communication.steps,
    },
    rawTrentesimi,
    totalTrentesimi,
    killerSwitchApplied: fired.length > 0,
    killerCap,
    firedKillers: fired,
    fatalErrors: fired.map((rule) => ({
      description: rule.label,
      rationale: `Killer switch del banco LIS, tetto ${rule.maxScoreCap}/30.`,
    })),
    reflexSpendEuro: input.state.reflexSpendEuro,
    inappropriateSpendEuro: economy.inappropriateSpendEuro,
    clinicalPenaltiesApplied: {
      invalidClinicalReport: false,
      dischargeDiaryMalus: false,
      physicalExamMalus: false,
      hiddenStressMalus: false,
    },
  };
}
