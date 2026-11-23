import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { assertPlayableCase } from "@/lib/cases/case-import-schema";
import { knowledgeBaseCaseSchema } from "@/lib/cases/knowledge-base-case-schema";
import {
  LAB_GOLD_CASES,
  toLabKnowledgePayload,
  type LabGoldCase,
} from "@/lib/simulator/data/laboratory-gold-cases";
import { gradeLaboratorySession } from "@/lib/simulator/laboratory-scoring";
import {
  LabCaseBlueprintSchema,
  emptyLabWorkbenchState,
  extractLabBlueprintV2,
  parseLabCaseBlueprint,
  sanitizeLabBlueprintForClient,
  type LabWorkbenchState,
} from "@/lib/simulator/laboratory-workbench";

const SPOILER =
  /emolizz|sottoriemp|biotina|\bptt\b|wbit|pseudopiastrin|non si firma|rifiutare|westgard|meningite|lupus|promielocitica|pml-rara|ahtr|emolitica acuta|lc-ms|glomerulare|anti-kell/i;

const GHOST = /diario di dimissione|esame obiettivo|stress nascosto|penalit[aà] di reparto/i;

function perfectState(entry: LabGoldCase): LabWorkbenchState {
  const blueprint = entry.blueprint;
  const at = "2026-11-23T09:00:00.000Z";
  const mandatory = blueprint.reflexCatalog.filter((item) => item.expectedAction === "MANDATORY");
  const spend = mandatory.reduce((sum, item) => sum + item.costEuro, 0);
  const concepts = blueprint.evaluation.expectedValidationNoteConcepts.join(". ");
  const note = `${concepts}. Nota di validazione del banco LIS, coerente con il ticket.`;
  const state: LabWorkbenchState = {
    version: 2,
    unlockedInvestigations: blueprint.evaluation.requiredInvestigations.map((id) => ({
      id,
      unlockedAtIso: at,
    })),
    requestedReflexIds: mandatory.map((item) => ({
      id: item.id,
      orderedAtIso: at,
      costEuro: item.costEuro,
    })),
    reflexSpendEuro: Math.round(spend * 100) / 100,
    dispositions: Object.fromEntries(
      blueprint.analytes.map((analyte) => [
        analyte.id,
        {
          action: analyte.expectedDisposition,
          ...(analyte.expectedDisposition === "VALIDATE" || !analyte.expectedReasonCode
            ? {}
            : { reasonCode: analyte.expectedReasonCode }),
          decidedAtIso: at,
        },
      ]),
    ),
    validationNote: note,
    interprofessionalLog: [
      {
        role: "user",
        target: "tslb",
        content: "Confermo l'ispezione e la disposizione prima della firma.",
        createdAtIso: at,
      },
      {
        role: "tslb",
        content: "Ricevuto. Eseguo solo i controlli chiesti sul banco.",
        createdAtIso: at,
      },
    ],
  };
  if (blueprint.criticalValuePolicy.required) {
    state.criticalNotification = {
      sent: true,
      channel: "PHONE",
      recipientName: "Medico raggiungibile",
      readBackConfirmed: true,
      notifiedAtIso: at,
      elapsedMinutes: Math.min(8, blueprint.criticalValuePolicy.slaMinutes),
    };
  }
  return state;
}

test("venticinque casi gold: codici, accessi, difficoltà e titoli ciechi", () => {
  assert.equal(LAB_GOLD_CASES.length, 25);
  const ids = LAB_GOLD_CASES.map((entry) => entry.id);
  const accessions = LAB_GOLD_CASES.map((entry) => entry.blueprint.accessionNumber);
  assert.equal(new Set(ids).size, 25);
  assert.equal(new Set(accessions).size, 25);
  assert.deepEqual(
    ids,
    Array.from({ length: 25 }, (_, index) => `LABO-V2-${String(index + 1).padStart(2, "0")}`),
  );
  const count = (difficulty: LabGoldCase["difficulty"]) =>
    LAB_GOLD_CASES.filter((entry) => entry.difficulty === difficulty).length;
  assert.equal(count("EASY"), 5);
  assert.equal(count("MEDIUM"), 10);
  assert.equal(count("HARD"), 10);
  for (const entry of LAB_GOLD_CASES) {
    assert.equal(SPOILER.test(entry.title), false, entry.id);
  }
});

test("integrità del blueprint, del catalogo e della busta CI", () => {
  for (const entry of LAB_GOLD_CASES) {
    const parsed = LabCaseBlueprintSchema.safeParse(entry.blueprint);
    assert.equal(parsed.success, true, entry.id);
    const analyteIds = new Set(entry.blueprint.analytes.map((analyte) => analyte.id));
    const reflexIds = entry.blueprint.reflexCatalog.map((item) => item.id);
    assert.equal(new Set(reflexIds).size, reflexIds.length, entry.id);
    for (const analyte of entry.blueprint.analytes) {
      assert.ok(analyte.deltaCheck, `${entry.id} ${analyte.id}`);
    }
    for (const rule of entry.blueprint.evaluation.killerSwitches) {
      const trigger = rule.trigger;
      if (trigger.kind === "VALIDATE_UNRELIABLE_ANALYTE") {
        assert.ok(analyteIds.has(trigger.analyteId), `${entry.id} ${rule.id}`);
      }
      if (trigger.kind === "AUTHORIZE_CONTRAINDICATED_ACTION") {
        assert.ok(reflexIds.includes(trigger.reflexId), `${entry.id} ${rule.id}`);
      }
      if (trigger.kind === "ACCEPT_PHONE_RELABEL" && trigger.analyteId) {
        assert.ok(analyteIds.has(trigger.analyteId), `${entry.id} ${rule.id}`);
      }
    }
    if (entry.blueprint.evaluation.requiredInvestigations.includes("morphologyOrTrace")) {
      assert.ok(entry.blueprint.investigations.morphologyOrTrace, entry.id);
    }
    const payload = toLabKnowledgePayload(entry);
    const envelope = knowledgeBaseCaseSchema.safeParse(payload);
    assert.equal(envelope.success, true, entry.id);
    const playable = assertPlayableCase(payload);
    assert.equal(playable.ok, true, `${entry.id} ${playable.issues.map((issue) => issue.message).join("; ")}`);
    assert.ok(parseLabCaseBlueprint(payload), entry.id);
    const mandatorySpend = entry.blueprint.reflexCatalog
      .filter((item) => item.expectedAction === "MANDATORY")
      .reduce((sum, item) => sum + item.costEuro, 0);
    assert.ok(entry.blueprint.budgetEuro + 0.001 >= mandatorySpend, entry.id);
  }
});

test("extractLabBlueprintV2 legge il payload avvolto di LABO-V2-08", () => {
  const entry = LAB_GOLD_CASES.find((item) => item.id === "LABO-V2-08");
  assert.ok(entry);
  const payload = toLabKnowledgePayload(entry);
  const shapes = [
    entry.blueprint,
    payload,
    { caseData: { rawData: payload } },
    { labBlueprintV2: entry.blueprint },
  ];
  for (const raw of shapes) {
    const blueprint = extractLabBlueprintV2(raw);
    assert.ok(blueprint);
    assert.equal(blueprint.version, 2);
    assert.equal(blueprint.accessionNumber, "ACC-26008");
    assert.deepEqual(
      blueprint.analytes.map((analyte) => analyte.id),
      entry.blueprint.analytes.map((analyte) => analyte.id),
    );
    assert.deepEqual(
      Object.keys(blueprint.investigations).sort(),
      Object.keys(entry.blueprint.investigations).sort(),
    );
    assert.ok(blueprint.personas.tslb.briefing.length > 20);
    assert.ok(blueprint.personas.clinician.hiddenHistory.length > 20);
    assert.ok(blueprint.personas.clinician.pressures.length > 0);
  }
  assert.equal(extractLabBlueprintV2({ title: "ticket senza blueprint" }), null);
});

const VISUAL_SPOILER = /westgard violat|1_3s|2_2s|R_4s|pseudopiastrin|pseudotrombocit|\bPTT\b|\bTTP\b|wbit/i;

test("carta di controllo e tracciati restano in controllo e senza spoiler", () => {
  const viewer = readFileSync(
    new URL("../../components/simulator/LabVisualDiagnostics.tsx", import.meta.url),
    "utf8",
  );
  assert.equal(viewer.includes("Math.random"), false);
  assert.equal(VISUAL_SPOILER.test(viewer), false);
  for (const entry of LAB_GOLD_CASES) {
    const chart = entry.blueprint.investigations.qcStatus.leveyJennings;
    assert.ok(chart, entry.id);
    assert.ok(chart.points.length >= 12 && chart.points.length <= 15, entry.id);
    if (entry.blueprint.investigations.qcStatus.status === "IN_CONTROL") {
      for (let index = 0; index < chart.points.length; index += 1) {
        const point = chart.points[index]!;
        assert.ok(Math.abs(point.value - chart.mean) < chart.sd * 2, `${entry.id} ${point.runLabel}`);
      }
    }
    assert.equal(VISUAL_SPOILER.test(JSON.stringify(chart)), false, entry.id);
  }
  const byId = new Map(LAB_GOLD_CASES.map((entry) => [entry.id, entry]));
  assert.equal(byId.get("LABO-V2-12")?.blueprint.investigations.morphologyOrTrace?.visual?.type, "MICROSCOPY");
  assert.equal(byId.get("LABO-V2-13")?.blueprint.investigations.morphologyOrTrace?.visual?.type, "ELECTROPHORESIS");
  assert.equal(byId.get("LABO-V2-15")?.blueprint.investigations.morphologyOrTrace?.visual?.type, "MICROSCOPY");
  const clumps = byId.get("LABO-V2-12")?.blueprint.investigations.morphologyOrTrace?.visual;
  const fragments = byId.get("LABO-V2-15")?.blueprint.investigations.morphologyOrTrace?.visual;
  const trace = byId.get("LABO-V2-13")?.blueprint.investigations.morphologyOrTrace?.visual;
  assert.equal(clumps?.type === "MICROSCOPY" && clumps.elements.some((item) => item.kind === "PLT_CLUMP" && item.count > 0), true);
  assert.equal(clumps?.type === "MICROSCOPY" && clumps.elements.some((item) => item.kind === "SCHISTOCYTE"), false);
  assert.equal(
    fragments?.type === "MICROSCOPY" && fragments.elements.some((item) => item.kind === "SCHISTOCYTE" && item.count >= 4),
    true,
  );
  assert.equal(fragments?.type === "MICROSCOPY" && fragments.elements.some((item) => item.kind === "PLT_CLUMP"), false);
  if (fragments?.type === "MICROSCOPY") {
    const reds = fragments.elements.find((item) => item.kind === "RBC_NORMAL")?.count ?? 0;
    const schistocytes = fragments.elements.find((item) => item.kind === "SCHISTOCYTE")?.count ?? 0;
    assert.ok(schistocytes / (reds + schistocytes) > 0.04);
  }
  assert.equal(trace?.type === "ELECTROPHORESIS" && trace.highlightZone, "γ");
  if (trace?.type === "ELECTROPHORESIS") {
    const gamma = trace.fractions.find((row) => row.label === "γ");
    assert.ok(gamma && gamma.percent > 18);
    assert.equal(VISUAL_SPOILER.test(JSON.stringify(trace)), false);
  }
  const urine = byId.get("LABO-V2-19")?.blueprint.investigations.morphologyOrTrace?.visual;
  const csf = byId.get("LABO-V2-18")?.blueprint.investigations.morphologyOrTrace?.visual;
  const ana = byId.get("LABO-V2-22")?.blueprint.investigations.morphologyOrTrace?.visual;
  const mixing = byId.get("LABO-V2-24")?.blueprint.investigations.morphologyOrTrace?.visual;
  const scatter = byId.get("LABO-V2-25")?.blueprint.investigations.morphologyOrTrace?.visual;
  const chart20 = byId.get("LABO-V2-20")?.blueprint.investigations.qcStatus.leveyJennings;
  assert.equal(byId.get("LABO-V2-20")?.blueprint.investigations.qcStatus.status, "WESTGARD_WARNING");
  assert.ok(chart20 && chart20.points.some((point) => Math.abs(point.value - chart20.mean) >= chart20.sd * 3));
  assert.equal(urine?.type === "MICROSCOPY" && urine.specimen, "URINE_SEDIMENT");
  if (urine?.type === "MICROSCOPY") {
    const acanthocytes = urine.elements.find((item) => item.kind === "ACANTHOCYTE")?.count ?? 0;
    const reds = urine.elements.find((item) => item.kind === "RBC_NORMAL")?.count ?? 0;
    assert.ok(urine.elements.some((item) => item.kind === "RBC_CAST" && item.count > 0));
    assert.ok(acanthocytes / (acanthocytes + reds) > 0.4);
  }
  assert.equal(csf?.type === "MICROSCOPY" && csf.specimen, "CSF_CYTOSPIN");
  assert.equal(
    csf?.type === "MICROSCOPY" &&
      csf.elements.some((item) => item.kind === "NEUTROPHIL") &&
      csf.elements.some((item) => item.kind === "BACTERIA"),
    true,
  );
  assert.equal(ana?.type === "MICROSCOPY" && ana.specimen, "ANA_IFI");
  assert.equal(ana?.type === "MICROSCOPY" && ana.elements.some((item) => item.kind === "IFI_HOMOGENEOUS"), true);
  assert.equal(mixing?.type, "MIXING_STUDY");
  if (mixing?.type === "MIXING_STUDY") {
    assert.ok(mixing.immediateMixSec > mixing.controlSec + 15);
    assert.ok(mixing.incubatedMixSec > mixing.controlSec + 15);
  }
  assert.equal(scatter?.type, "SCATTERGRAM");
  for (const entry of LAB_GOLD_CASES) {
    const visual = entry.blueprint.investigations.morphologyOrTrace?.visual;
    if (visual) assert.equal(VISUAL_SPOILER.test(JSON.stringify(visual)), false, entry.id);
    const locked = sanitizeLabBlueprintForClient(entry.blueprint, emptyLabWorkbenchState());
    const hidden = JSON.stringify(locked);
    assert.equal(hidden.includes("expectedDisposition"), false, entry.id);
    assert.equal(hidden.includes("expectedReasonCode"), false, entry.id);
    const lot = entry.blueprint.investigations.qcStatus.leveyJennings?.lotNumber;
    if (lot) assert.equal(hidden.includes(lot), false, entry.id);
    if (visual?.type === "MICROSCOPY") assert.equal(hidden.includes(visual.caption), false, entry.id);
  }
});

test("il percorso perfetto resta sopra 28/30 senza killer e senza penalità fantasma", () => {
  for (const entry of LAB_GOLD_CASES) {
    const grade = gradeLaboratorySession({
      blueprint: entry.blueprint,
      state: perfectState(entry),
    });
    assert.equal(grade.killerSwitchApplied, false, entry.id);
    assert.ok(grade.totalTrentesimi >= 28, `${entry.id} ${grade.totalTrentesimi}`);
    for (const flag of Object.values(grade.clinicalPenaltiesApplied)) {
      assert.equal(flag, false, entry.id);
    }
    const dumped = JSON.stringify(grade.waterfall);
    assert.equal(GHOST.test(dumped), false, entry.id);
  }
});
