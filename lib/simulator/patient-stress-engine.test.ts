/**
 *   npx tsx --test lib/simulator/patient-stress-engine.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { buildPatientSystemPrompt } from "@/lib/simulator/patient-system-prompt";
import {
  appendStressTimeline,
  computePatientStress,
  CRITICAL_STRESS_THRESHOLD,
  isCriticalPatientStress,
  resolveCaseStressProfile,
  withDeteriorationStress,
} from "@/lib/simulator/patient-stress-engine";
import { communicationStressPenalty } from "@/lib/services/evaluation-scoring";

type CaseFile = {
  id: string;
  title: string;
  description: string;
  presentation?: string;
  patientPrompt?: string;
  setting?: string;
  baselineExamFindings?: Record<string, unknown>;
};

function loadCase(relativePath: string): CaseFile {
  return JSON.parse(readFileSync(path.join(process.cwd(), relativePath), "utf8")) as CaseFile;
}

function profileOf(file: CaseFile) {
  return resolveCaseStressProfile({
    id: file.id,
    title: file.title,
    description: file.description,
    presentation: file.presentation,
    patientPrompt: file.patientPrompt,
    setting: file.setting,
    baselineExamFindings: file.baselineExamFindings,
  });
}

describe("contextual patient stress", () => {
  it("starts PNEUMO-001 much higher than stable EMAT-012", () => {
    const pneumo = profileOf(loadCase("knowledge_base/pneumologia/cases/PNEUMO-001.json"));
    const emat = profileOf(loadCase("knowledge_base/ematologia/cases/EMAT-012.json"));
    assert.ok(pneumo.initialStress >= 55 && pneumo.initialStress <= 65);
    assert.equal(pneumo.physiologicalFloor, 45);
    assert.equal(pneumo.caseContext.dominantSymptom, "dyspnea");
    assert.ok(emat.initialStress >= 22 && emat.initialStress <= 32);
    assert.ok(emat.physiologicalFloor <= 15);
    assert.ok(pneumo.initialStress - emat.initialStress >= 20);
    assert.ok(pneumo.physiologicalFloor > emat.physiologicalFloor);
  });

  it("treats CARDIO-008 as anxious palpitations and shrinks a repeated formula", () => {
    const cardio = profileOf(loadCase("knowledge_base/cardiologia/cases/CARDIO-008.json"));
    assert.equal(cardio.reactivityType, "hyper");
    assert.equal(cardio.caseContext.dominantSymptom, "chest");
    const line =
      "Capisco, è spaventoso. Le spiego il percorso: adesso controlliamo il cuore, passo passo.";
    const first = computePatientStress({
      currentStress: cardio.initialStress,
      profile: cardio,
      lastUserMessage: line,
    });
    const repeated = computePatientStress({
      currentStress: cardio.initialStress,
      profile: cardio,
      lastUserMessage: line,
      recentDoctorMessages: [line],
    });
    assert.ok(first.delta < 0);
    assert.ok(repeated.delta > first.delta);
    assert.match(repeated.reason, /ripete|stessa frase/i);
    assert.equal(first.category === "communication" || first.category === "clinical_action", true);
  });

  it("uses one inclusive crisis threshold of 80", () => {
    assert.equal(CRITICAL_STRESS_THRESHOLD, 80);
    assert.equal(isCriticalPatientStress(80), true);
    assert.equal(isCriticalPatientStress(79), false);
    assert.equal(communicationStressPenalty(80).criticalPatientStress, true);
    assert.equal(communicationStressPenalty(79).criticalPatientStress, false);
    const crisis = buildPatientSystemPrompt({
      patientAge: "70",
      patientSex: "M",
      chiefComplaint: "Fiato corto",
      clinicalStory: "Fiato corto",
      vitalSigns: "{}",
      patientStress: 80,
      stressReason: "Peggioramento clinico per ritardo negli interventi",
      trueDiagnosis: "",
      abnormalExams: "",
      clinicalSignsJson: "[]",
      painNrs: null,
    });
    const tense = buildPatientSystemPrompt({
      patientAge: "70",
      patientSex: "M",
      chiefComplaint: "Fiato corto",
      clinicalStory: "Fiato corto",
      vitalSigns: "{}",
      patientStress: 79,
      trueDiagnosis: "",
      abnormalExams: "",
      clinicalSignsJson: "[]",
      painNrs: null,
    });
    assert.match(crisis, /FASCIA STRESS 80\/100 — Crisi/);
    assert.match(crisis, /Motivo stato attuale: Peggioramento clinico per ritardo negli interventi/);
    assert.ok(crisis.indexOf("Motivo stato attuale") > crisis.indexOf("SCHEDA PERSONA"));
    assert.ok(crisis.indexOf("Parametri attuali") > crisis.indexOf("Motivo stato attuale"));
    assert.doesNotMatch(tense, /FASCIA STRESS 79\/100 — Crisi/);
  });

  it("records delta, reason and a capped timeline", () => {
    const emat = profileOf(loadCase("knowledge_base/ematologia/cases/EMAT-012.json"));
    const event = computePatientStress({
      currentStress: emat.initialStress,
      profile: emat,
      lastUserMessage: "La troponina e la neutropenia vanno interpretate subito.",
    });
    assert.equal(typeof event.delta, "number");
    assert.equal(event.stress, emat.initialStress + event.delta);
    assert.match(event.reason, /Gergo tecnico non spiegato/);
    const raised = withDeteriorationStress({ ...event, stress: 40, delta: 0 });
    assert.ok(raised.stress >= 85);
    assert.equal(raised.category, "deterioration");
    assert.match(raised.reason, /Peggioramento clinico/);
    const timeline = appendStressTimeline(
      [{ atMinute: 0, turn: 0, stress: 26, delta: 0, reason: "Inizio", category: "baseline" }],
      {
        atMinute: 4,
        turn: 2,
        stress: event.stress,
        delta: event.delta,
        reason: event.reason,
        category: event.category,
      },
    );
    assert.equal(timeline[0]?.category, "baseline");
    assert.equal(timeline.at(-1)?.reason, event.reason);
    const bulky = appendStressTimeline(
      Array.from({ length: 50 }, (_, index) => ({
        atMinute: index,
        turn: index,
        stress: 30,
        delta: 5,
        reason: `evento ${index}`,
        category: "communication" as const,
      })),
      {
        atMinute: 51,
        turn: 51,
        stress: 80,
        delta: 10,
        reason: "ultimo",
        category: "deterioration",
      },
      40,
    );
    assert.ok(bulky.length <= 40);
    assert.equal(bulky.at(-1)?.reason, "ultimo");
  });
});
