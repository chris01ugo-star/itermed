/**
 * The patient must never speak an unfilled bracket slot,
 * and a later turn must not be replaced by the opening line.
 *
 *   npx tsx --test lib/simulator/patient-opening.test.ts
 */
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { resolvePatientProfile } from "@/lib/cases/resolve-patient-profile";
import { AUTHORED_CASE_REGISTRY } from "@/lib/data/cases/registry-store";
import type { PatientProfile } from "@/lib/data/cases/types";
import { buildPatientOpeningMessage, hasPatientPlaceholder } from "@/lib/simulator/patient-opening";
import {
  createPatientOutputFilter,
  sanitizePatientUtterance,
} from "@/lib/simulator/patient-output-sanitizer";
import { buildPatientSystemPrompt } from "@/lib/simulator/patient-system-prompt";

const BROKEN_OPENING = "Buongiorno. Da un po’ ho [sintomi attuali], e per questo sono venuto qui.";
const ROBOTIC = /non sto bene, e per questo sono venut[oa] qui/i;

type CatalogCase = {
  id: string;
  source: string;
  title?: string;
  description?: string;
  patientPrompt?: string;
  pastMedicalHistory?: string;
  presentation?: string;
  setting?: string;
  physicalExamSummary?: string;
  patientProfile?: PatientProfile;
  baselineExamFindings?: Record<string, unknown>;
};

async function walkJson(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walkJson(full)));
    else if (entry.name.endsWith(".json")) files.push(full);
  }
  return files;
}

async function loadCatalog(): Promise<CatalogCase[]> {
  const root = path.join(process.cwd(), "knowledge_base");
  const files = await walkJson(root);
  const fromJson: CatalogCase[] = [];
  for (const file of files) {
    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(file, "utf8"));
    } catch {
      continue;
    }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const row = raw as CatalogCase & { physicalExam?: { summary?: string } };
    if (typeof row.id !== "string" || typeof row.patientPrompt !== "string") continue;
    fromJson.push({
      ...row,
      source: path.relative(process.cwd(), file),
      physicalExamSummary: row.physicalExam?.summary,
    });
  }
  const fromRegistry: CatalogCase[] = AUTHORED_CASE_REGISTRY.map((item) => ({
    id: item.id,
    source: "registry",
    title: item.title,
    description: item.description,
    patientPrompt: item.patientPrompt,
    pastMedicalHistory: item.pastMedicalHistory,
    presentation: item.presentation,
    setting: item.setting,
    physicalExamSummary: item.physicalExam?.summary,
    patientProfile: item.patientProfile,
    baselineExamFindings: item.baselineExamFindings,
  }));
  return [...fromJson, ...fromRegistry];
}

function openingAndPrompt(item: CatalogCase): { opening: string; prompt: string } {
  const profile = resolvePatientProfile({
    id: item.id,
    title: item.title,
    description: item.description,
    patientPrompt: item.patientPrompt,
    pastMedicalHistory: item.pastMedicalHistory,
    presentation: item.presentation,
    setting: item.setting,
    baselineExamFindings: item.baselineExamFindings,
  });
  const opening = buildPatientOpeningMessage({
    chiefComplaint: profile.triageAnamnesis,
    presentation: item.presentation,
    patientPrompt: item.patientPrompt,
    clinicalStory: item.description,
    physicalExamSummary: item.physicalExamSummary,
    patientName: profile.name,
    patientSex: profile.sex,
  });
  const prompt = buildPatientSystemPrompt({
    patientAge: profile.age != null ? String(profile.age) : "",
    patientName: profile.name,
    patientSex: profile.sex ?? "",
    chiefComplaint: profile.triageAnamnesis,
    clinicalStory: profile.triageAnamnesis,
    pastMedicalHistory: item.pastMedicalHistory,
    presentation: item.presentation,
    sourceDescription: item.description,
    setting: item.setting,
    vitalSigns: "{}",
    patientStress: 20,
    trueDiagnosis: "",
    abnormalExams: "",
    clinicalSignsJson: "[]",
    painNrs: null,
    roleplayScript: item.patientPrompt,
    physicalExamSummary: item.physicalExamSummary,
    patientProfile: item.patientProfile,
    knownAllergies: profile.allergies,
    currentTurn: 2,
  });
  return { opening, prompt };
}

describe("patient opening placeholder", () => {
  it("fills only the unfilled slot and does not invent the robotic greeting", () => {
    const spoken = sanitizePatientUtterance(BROKEN_OPENING, {
      turn: 1,
      symptomPhrase: "un dolore al petto",
    });
    assert.equal(hasPatientPlaceholder(spoken), false);
    assert.match(spoken, /dolore al petto/);
    assert.doesNotMatch(spoken, ROBOTIC);
    assert.doesNotMatch(spoken, /\[/);
  });

  it("on turn 2 keeps a real answer about alcohol and home medicines", () => {
    const answer = "No, non bevo alcol e a casa prendo solo la pastiglia della pressione.";
    assert.equal(sanitizePatientUtterance(answer, { turn: 2, symptomPhrase: "dolore al petto" }), answer);

    const echoed = "[PAZIENTE] No, non bevo alcol. In famiglia mio padre ha avuto un infarto. Non ho allergie.";
    const cleaned = sanitizePatientUtterance(echoed, { turn: 2, symptomPhrase: "dolore al petto" });
    assert.match(cleaned, /non bevo alcol/);
    assert.match(cleaned, /padre/);
    assert.match(cleaned, /allergie/);
    assert.doesNotMatch(cleaned, /\[PAZIENTE\]/);
    assert.doesNotMatch(cleaned, ROBOTIC);

    const filter = createPatientOutputFilter({ turn: 2, symptomPhrase: "dolore al petto" });
    const streamed = `${filter.push("[PAZIENTE] ")}${filter.push(answer)}${filter.finish()}`;
    assert.match(streamed, /non bevo alcol/);
    assert.doesNotMatch(streamed, ROBOTIC);
  });

  it("strips a stage direction and leaves the words around it", () => {
    const spoken = sanitizePatientUtterance("[geme] La luce. No. La nuca.", { turn: 2 });
    assert.equal(spoken, "La luce. No. La nuca.");
  });

  it("keeps every catalog opening and patient prompt free of unreplaced slots", async () => {
    const catalog = await loadCatalog();
    assert.ok(catalog.length >= 327, `catalog too small: ${catalog.length}`);
    const failures: string[] = [];
    for (const item of catalog) {
      const { opening, prompt } = openingAndPrompt(item);
      if (hasPatientPlaceholder(opening) || /sintomi attuali/i.test(opening) || /\[/.test(opening) || ROBOTIC.test(opening)) {
        failures.push(`${item.id} [${item.source}] opening: ${opening}`);
      }
      if (hasPatientPlaceholder(prompt) || /\[sintomi attuali\]/i.test(prompt) || ROBOTIC.test(prompt)) {
        failures.push(`${item.id} [${item.source}] prompt contains a slot or the robotic greeting`);
      }
      if (!/VERITÀ ANAMNESTICA VINCOLANTE/.test(prompt) || !/STATO ATTUALE DELLA VISITA/.test(prompt)) {
        failures.push(`${item.id} [${item.source}] missing visit or anamnesis anchor`);
      }
    }
    assert.deepEqual(failures, []);
  });
});
