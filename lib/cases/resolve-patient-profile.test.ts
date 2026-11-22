/**
 *   npx tsx --test lib/cases/resolve-patient-profile.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { buildSimulatorCasePayload } from "@/lib/cases/case-payload";
import { resolvePatientProfile } from "@/lib/cases/resolve-patient-profile";
import { buildPatientSystemPrompt } from "@/lib/simulator/patient-system-prompt";

type CaseFile = {
  id: string;
  title: string;
  description: string;
  patientPrompt?: string;
  pastMedicalHistory?: string;
  presentation?: string;
  setting?: string;
  diagnosis?: string;
  condition?: string;
  correctSolution?: string;
  goldStandardPath?: string[];
  baselineExamFindings?: Record<string, unknown>;
};

function loadCase(relativePath: string): CaseFile {
  const absolute = path.join(process.cwd(), relativePath);
  return JSON.parse(readFileSync(absolute, "utf8")) as CaseFile;
}

function chartAndPrompt(file: CaseFile) {
  const profile = resolvePatientProfile(file);
  const payload = buildSimulatorCasePayload({
    id: file.id,
    title: file.title,
    description: file.description,
    specialty: null,
    difficulty: "HARD",
    estimatedDurationMinutes: 40,
    patientPrompt: file.patientPrompt ?? "",
    pastMedicalHistory: file.pastMedicalHistory,
    presentation: file.presentation,
    setting: file.setting,
    diagnosis: file.diagnosis,
    condition: file.condition,
    correctSolution: file.correctSolution,
    goldStandardPath: file.goldStandardPath,
    baselineExamFindings: file.baselineExamFindings ?? {},
  });
  const prompt = buildPatientSystemPrompt({
    patientAge: profile.age != null ? String(profile.age) : "",
    patientName: profile.name,
    patientSex: profile.sex ?? "",
    chiefComplaint: profile.triageAnamnesis,
    clinicalStory: profile.triageAnamnesis,
    pastMedicalHistory: profile.clinicalHistory,
    presentation: profile.triageAnamnesis,
    setting: file.setting,
    vitalSigns: "{}",
    patientStress: 20,
    trueDiagnosis: file.correctSolution ?? "",
    abnormalExams: "",
    clinicalSignsJson: "[]",
    painNrs: null,
    roleplayScript: file.patientPrompt,
    knownAllergies: profile.allergies,
  });
  return { profile, payload, prompt };
}

describe("resolvePatientProfile", () => {
  it("keeps Giovanni, 64, M aligned on CARDIO-008 without the hidden rhythm name", () => {
    const { profile, payload, prompt } = chartAndPrompt(
      loadCase("knowledge_base/cardiologia/cases/CARDIO-008.json"),
    );
    assert.equal(profile.name, "Giovanni");
    assert.equal(profile.age, 64);
    assert.equal(profile.sex, "M");
    assert.match(profile.clinicalHistory, /non fumatore/i);
    assert.doesNotMatch(profile.displayTitle, /Donna|fibrillazione|ESC|GOLD/i);
    assert.equal(payload.resolvedProfile.name, profile.name);
    assert.equal(payload.resolvedProfile.age, 64);
    assert.match(prompt, /Nome: Giovanni/);
    assert.match(prompt, /64 anni/);
    assert.doesNotMatch(prompt, /fibrillazione atriale|STEMI|Diagnosi da non dire/i);
    assert.equal("correctSolution" in payload, false);
    assert.equal("goldStandardPath" in payload, false);
  });

  it("keeps Fabio, 41, M aligned on EMAT-012 without guideline acronyms", () => {
    const { profile, payload, prompt } = chartAndPrompt(
      loadCase("knowledge_base/ematologia/cases/EMAT-012.json"),
    );
    assert.equal(profile.name, "Fabio");
    assert.equal(profile.age, 41);
    assert.equal(profile.sex, "M");
    assert.match(profile.clinicalHistory, /Nessuna patologia cronica nota/);
    const chart = `${profile.displayTitle}\n${profile.triageAnamnesis}\n${profile.clinicalHistory}`;
    assert.doesNotMatch(chart, /ELN|BCR|MRD|leucemia|blasti/i);
    assert.equal(payload.resolvedProfile.name, "Fabio");
    assert.match(prompt, /Nome: Fabio/);
    assert.match(prompt, /41 anni/);
    assert.doesNotMatch(prompt, /BCR|MRD|ELN|leucemia|58/);
    assert.equal("goldStandardPath" in payload, false);
  });

  it("keeps Marco, 70, M and the known chronic lung disease on PNEUMO-001", () => {
    const { profile, payload, prompt } = chartAndPrompt(
      loadCase("knowledge_base/pneumologia/cases/PNEUMO-001.json"),
    );
    assert.equal(profile.name, "Marco");
    assert.equal(profile.age, 70);
    assert.equal(profile.sex, "M");
    assert.match(profile.clinicalHistory, /BPCO/);
    assert.doesNotMatch(profile.displayTitle, /GOLD|nomenclatore|steroide/i);
    assert.equal(payload.resolvedProfile.clinicalHistory, profile.clinicalHistory);
    assert.match(prompt, /Nome: Marco/);
    assert.match(prompt, /BPCO/);
    assert.match(prompt, /70 anni/);
    assert.doesNotMatch(`${profile.triageAnamnesis} ${profile.displayTitle}`, /GOLD|98%/);
  });

  it("does not invent 58 years when the case has no age", () => {
    const profile = resolvePatientProfile({
      id: "DEMO-000",
      title: "Accesso per cefalea",
      description: "Cefalea da due giorni.",
    });
    assert.equal(profile.age, null);
    assert.equal(profile.sex, null);
  });
});
