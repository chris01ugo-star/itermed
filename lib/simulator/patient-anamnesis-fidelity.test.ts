/**
 * Familiarità, allergie e farmaci domiciliari devono restare nel prompt del paziente.
 * Le contraddizioni fra patientPrompt e pastMedicalHistory sono solo segnalate:
 * i JSON non si correggono in questo batch.
 *
 *   npx tsx --test lib/simulator/patient-anamnesis-fidelity.test.ts
 */
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { patientSafeAnamnesisFact } from "@/lib/cases/resolve-patient-profile";
import { resolvePatientProfile } from "@/lib/cases/resolve-patient-profile";
import { AUTHORED_CASE_REGISTRY } from "@/lib/data/cases/registry-store";
import { buildPatientSystemPrompt } from "@/lib/simulator/patient-system-prompt";

type Clue = { prompt?: string; rationale?: string };

type CaseRecord = {
  id: string;
  source: string;
  title?: string;
  description?: string;
  patientPrompt?: string;
  pastMedicalHistory?: string;
  presentation?: string;
  setting?: string;
  anamnesisQuestions?: Clue[];
  baselineExamFindings?: Record<string, unknown>;
};

const FAMILY_CUE =
  /\b(familiarit[aà]|familiare|padre|madre|pap[àa]|mamma|fratell\w*|sorell\w*|nonn[oa]|zi[oa]|figli[oa]|genitori|ereditari\w*)\b/iu;
const FAMILY_DENIAL =
  /\b(nessuna\s+familiarit|non\s+(?:c['’]?è|ce|ho|ha)\s+familiarit|nega\s+familiarit|familiarit[aà]\s+negativa|nessun\s+familiare)\b/i;
const MED_CUE =
  /\b(farmac\w*|pillol\w*|assume|prende|in\s+terapia|terapia\s+domiciliare|terapia\s+in\s+atto|antibiotico)\b/i;
const ALLERGY_DENIAL =
  /\b(nessuna\s+allerg|non\s+(?:è\s+|e'\s+)?allergic|nega(?:\s+\w+){0,3}\s+allerg|non\s+ho\s+allerg|non\s+sono\s+allergic)\b/i;
const ALLERGY_POSITIVE = /allergic[oa]\s+a[l']?\s+([^.;]+)/i;
const EMPTY_FAMILY = "Nessuna familiarità esplicitata";

function sentencesOf(text: string): string[] {
  return text
    .split(/\n+|(?<=[.!?;])\s+/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter((part) => part.length >= 12);
}

function hasPositiveFamily(text: string): boolean {
  return sentencesOf(text).some((sentence) => FAMILY_CUE.test(sentence) && !FAMILY_DENIAL.test(sentence));
}

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

async function loadCatalog(): Promise<CaseRecord[]> {
  const root = path.join(process.cwd(), "knowledge_base");
  const files = await walkJson(root);
  const fromJson: CaseRecord[] = [];
  for (const file of files) {
    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(file, "utf8"));
    } catch {
      continue;
    }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const row = raw as CaseRecord;
    if (typeof row.id !== "string" || typeof row.pastMedicalHistory !== "string") continue;
    fromJson.push({ ...row, source: path.relative(process.cwd(), file) });
  }

  const fromRegistry: CaseRecord[] = AUTHORED_CASE_REGISTRY.map((item) => ({
    id: item.id,
    source: "registry",
    title: item.title,
    description: item.description,
    patientPrompt: item.patientPrompt,
    pastMedicalHistory: item.pastMedicalHistory,
    presentation: item.presentation,
    setting: item.setting,
    anamnesisQuestions: item.anamnesisQuestions,
    baselineExamFindings: item.baselineExamFindings,
  }));

  return [...fromJson, ...fromRegistry];
}

function promptFor(item: CaseRecord): string {
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
  return buildPatientSystemPrompt({
    patientAge: profile.age != null ? String(profile.age) : "",
    patientName: profile.name,
    patientSex: profile.sex ?? "M",
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
    knownAllergies: profile.allergies,
    anamnesisClues: item.anamnesisQuestions,
  });
}

function expectFact(prompt: string, fact: string): boolean {
  const safe = patientSafeAnamnesisFact(fact).replace(/\s+/g, " ").trim();
  if (safe.length < 12) return true;
  return prompt.toLowerCase().includes(safe.toLowerCase());
}

type Contradiction = { id: string; source: string; reason: string };

function contradictionsOf(item: CaseRecord): Contradiction[] {
  const prompt = item.patientPrompt ?? "";
  const history = item.pastMedicalHistory ?? "";
  const found: Contradiction[] = [];
  if (FAMILY_DENIAL.test(prompt) && hasPositiveFamily(history)) {
    found.push({
      id: item.id,
      source: item.source,
      reason: "patientPrompt nega la familiarità, pastMedicalHistory la riporta",
    });
  }
  const allergySentences = sentencesOf(history).filter(
    (sentence) => ALLERGY_POSITIVE.test(sentence) && !ALLERGY_DENIAL.test(sentence),
  );
  if (ALLERGY_DENIAL.test(prompt) && allergySentences.length > 0) {
    found.push({
      id: item.id,
      source: item.source,
      reason: "patientPrompt nega le allergie, pastMedicalHistory ne dichiara una",
    });
  }
  return found;
}

describe("patient anamnesis fidelity", () => {
  it("keeps CARDIO-023, REUMA-009 and PSIC-004 family facts and drops examiner rationales", async () => {
    const catalog = await loadCatalog();
    const wanted = ["CARDIO-023", "REUMA-009", "PSIC-004"];
    for (const id of wanted) {
      const item = catalog.find((row) => row.id === id);
      assert.ok(item, `caso ${id} assente dal catalogo JSON`);
      const prompt = promptFor(item);
      assert.match(prompt, /VERITÀ ANAMNESTICA VINCOLANTE/);
      assert.match(prompt, /Non negare MAI un fatto presente nello storico del caso/);
      assert.doesNotMatch(prompt, /Nessuna familiarità esplicitata/);
      assert.doesNotMatch(prompt, /puoi raccontare solo questo/i);
      for (const clue of item.anamnesisQuestions ?? []) {
        const rationale = clue.rationale?.trim() ?? "";
        if (rationale.length < 12) continue;
        assert.equal(prompt.includes(rationale), false, `${id} contiene il rationale «${rationale}»`);
      }
    }

    const cardio = promptFor(catalog.find((row) => row.id === "CARDIO-023")!);
    assert.match(cardio, /cardiomiopatia/i);
    assert.match(cardio, /padre/i);

    const reuma = promptFor(catalog.find((row) => row.id === "REUMA-009")!);
    assert.match(reuma, /madre/i);
    assert.match(reuma, /tiroidite/i);

    const psic = promptFor(catalog.find((row) => row.id === "PSIC-004")!);
    assert.match(psic, /madre/i);
    assert.match(psic, /QT lungo/i);
  });

  it("keeps family, allergy and home-drug facts from every catalog case", async () => {
    const catalog = await loadCatalog();
    const misses: string[] = [];
    for (const item of catalog) {
      const history = item.pastMedicalHistory ?? "";
      const family = sentencesOf(history).filter(
        (sentence) => FAMILY_CUE.test(sentence) && !FAMILY_DENIAL.test(sentence),
      );
      const meds = sentencesOf(history).filter((sentence) => MED_CUE.test(sentence));
      const allergies = sentencesOf(history).filter(
        (sentence) => ALLERGY_POSITIVE.test(sentence) && !ALLERGY_DENIAL.test(sentence),
      );
      if (family.length === 0 && meds.length === 0 && allergies.length === 0) continue;

      const prompt = promptFor(item);
      if (family.length > 0 && prompt.includes(EMPTY_FAMILY)) {
        misses.push(`${item.id}: familiarità presente ma il prompt dice «${EMPTY_FAMILY}»`);
      }
      for (const sentence of [...family, ...meds, ...allergies]) {
        if (!expectFact(prompt, sentence)) {
          misses.push(`${item.id}: manca «${sentence.slice(0, 80)}»`);
        }
      }
      for (const clue of item.anamnesisQuestions ?? []) {
        const rationale = clue.rationale?.replace(/\s+/g, " ").trim() ?? "";
        if (rationale.length < 24) continue;
        const corpus = [history, item.patientPrompt, item.presentation, item.description]
          .filter(Boolean)
          .join("\n");
        if (corpus.includes(rationale)) continue;
        if (prompt.includes(rationale)) {
          misses.push(`${item.id}: rationale esaminatore nel prompt «${rationale.slice(0, 80)}»`);
        }
      }
    }
    assert.deepEqual(misses, []);
  });

  it("lists patientPrompt denials that contradict pastMedicalHistory", async () => {
    const catalog = await loadCatalog();
    const rows = catalog.flatMap(contradictionsOf);
    if (rows.length > 0) {
      console.log(
        `ANAMNESIS_CONTRADICTION ${rows.length}\n${rows
          .map((row) => `${row.id} [${row.source}] ${row.reason}`)
          .join("\n")}`,
      );
    }
    assert.ok(Array.isArray(rows));
  });
});
