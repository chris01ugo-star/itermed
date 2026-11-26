/**
 * The patient must never speak an unfilled bracket slot.
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
import {
  buildPatientOpeningMessage,
  createPatientUtteranceFilter,
  hasPatientPlaceholder,
  sanitizePatientUtterance,
} from "@/lib/simulator/patient-opening";
import { buildPatientSystemPrompt } from "@/lib/simulator/patient-system-prompt";

const BROKEN_OPENING = "Buongiorno. Da un po’ ho [sintomi attuali], e per questo sono venuto qui.";

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
    const row = raw as CatalogCase & {
      physicalExam?: { summary?: string };
      patientProfile?: PatientProfile;
    };
    if (typeof row.id !== "string" || typeof row.patientPrompt !== "string") continue;
    fromJson.push({
      ...row,
      source: path.relative(process.cwd(), file),
      physicalExamSummary: row.physicalExam?.summary,
      patientProfile: row.patientProfile,
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
  });
  return { opening, prompt };
}

describe("patient opening placeholder", () => {
  it("replaces the production opening that left [sintomi attuali] unfilled", () => {
    const opening = buildPatientOpeningMessage({
      patientName: "Enrico",
      patientSex: "M",
      patientPrompt: "Sono Enrico. Il gene FLT3 e' mutato. Datemi i giorni scritti, non una dose che non c'e'.",
      presentation: "Propongono midostaurin dal giorno 1, oppure GO 9 mg/m2 al posto del midostaurin.",
      chiefComplaint: "AML fit, FLT3-ITD positivo.",
      physicalExamSummary: "Febbre assente, niente emorragia maggiore.",
    });
    const spoken = sanitizePatientUtterance(BROKEN_OPENING, opening);
    assert.equal(hasPatientPlaceholder(spoken), false);
    assert.equal(/sintomi attuali/i.test(spoken), false);
    assert.match(spoken, /febbre|sanguin/i);
    assert.doesNotMatch(spoken, /\[/);

    const filter = createPatientUtteranceFilter(opening);
    assert.equal(filter.push("Buongiorno. Da un po’ ho "), "");
    assert.equal(filter.push("[sintomi attuali], e per questo sono venuto qui."), "");
    const flushed = filter.finish();
    assert.equal(hasPatientPlaceholder(flushed), false);
    assert.match(flushed, /febbre|sanguin/i);
  });

  it("strips stage-direction brackets without inventing a new complaint", () => {
    const spoken = sanitizePatientUtterance("[geme] La luce. No. La nuca.", "Buongiorno. Ho la luce negli occhi.");
    assert.equal(spoken, "La luce. No. La nuca.");
    assert.equal(hasPatientPlaceholder(spoken), false);
  });

  it("keeps every catalog opening and patient prompt free of unreplaced slots", async () => {
    const catalog = await loadCatalog();
    assert.ok(catalog.length > 100, `catalog too small: ${catalog.length}`);
    const failures: string[] = [];
    for (const item of catalog) {
      const { opening, prompt } = openingAndPrompt(item);
      if (hasPatientPlaceholder(opening) || /sintomi attuali/i.test(opening) || /\[/.test(opening)) {
        failures.push(`${item.id} [${item.source}] opening: ${opening}`);
      }
      if (hasPatientPlaceholder(prompt) || /\[sintomi attuali\]/i.test(prompt)) {
        failures.push(`${item.id} [${item.source}] prompt contains an unreplaced placeholder`);
      }
    }
    assert.deepEqual(failures, []);
  });
});
