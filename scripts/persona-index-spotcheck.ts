/**
 * One-shot audit: every knowledge_base case resolves through the global index
 * and produces a distinct patient prompt. Then a live gpt-6-luna spot-check.
 *
 *   npx tsx scripts/persona-index-spotcheck.ts
 */
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { getKnowledgeBaseIndex, loadKnowledgeBaseCaseFromDisk } from "@/lib/data/cases/load-kb-case-file";
import { buildPatientSystemPrompt } from "@/lib/simulator/patient-system-prompt";
import type { ClinicalCase } from "@/lib/data/cases/types";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const PLACEHOLDER = "paziente in simulazione.";
const REQUIRED = [
  "condition",
  "setting",
  "presentation",
  "anamnesisQuestions",
  "pastMedicalHistory",
  "vitalSigns",
  "physicalExam",
] as const;

function specialtyOf(file: string): string {
  const parts = file.split(/[/\\]/);
  const kb = parts.lastIndexOf("knowledge_base");
  return parts[kb + 1] ?? "unknown";
}

function promptFor(c: ClinicalCase): string {
  const baseline = c.baselineExamFindings as {
    vitals?: object;
    demographics?: { age?: unknown; sex?: unknown; name?: unknown };
  } | null;
  const demo = baseline?.demographics;
  const vitals =
    baseline?.vitals && typeof baseline.vitals === "object" ? JSON.stringify(baseline.vitals) : "{}";
  return buildPatientSystemPrompt({
    patientAge: demo?.age != null && demo.age !== "" ? String(demo.age) : "n/d",
    patientName: typeof demo?.name === "string" ? demo.name : undefined,
    patientSex: typeof demo?.sex === "string" ? demo.sex : "",
    chiefComplaint: c.description,
    clinicalStory: c.description,
    setting: c.setting,
    condition: c.condition,
    presentation: c.presentation,
    pastMedicalHistory: c.pastMedicalHistory,
    redHerrings: c.redHerrings,
    anamnesisClues: (c.anamnesisQuestions ?? []).map((question) => ({
      prompt: question.prompt,
      rationale: question.rationale,
    })),
    physicalExamSummary: c.physicalExam?.summary,
    patientProfile: c.patientProfile,
    vitalSigns: vitals,
    patientStress: 20,
    trueDiagnosis: c.correctSolution,
    abnormalExams: "",
    clinicalSignsJson: "[]",
    painNrs: null,
    roleplayScript: c.patientPrompt,
  });
}

function missingFields(raw: Record<string, unknown>): string[] {
  const missing: string[] = [];
  for (const key of REQUIRED) {
    if (key === "vitalSigns") {
      const baseline = raw.baselineExamFindings;
      const vitals =
        baseline && typeof baseline === "object"
          ? (baseline as { vitals?: unknown }).vitals
          : undefined;
      if (!vitals || typeof vitals !== "object") missing.push(key);
      continue;
    }
    if (key === "physicalExam") {
      const exam = raw.physicalExam;
      const summary =
        exam && typeof exam === "object" ? (exam as { summary?: unknown }).summary : undefined;
      if (typeof summary !== "string" || summary.trim().length < 3) missing.push(key);
      continue;
    }
    if (key === "anamnesisQuestions") {
      if (!Array.isArray(raw.anamnesisQuestions) || raw.anamnesisQuestions.length === 0) {
        missing.push(key);
      }
      continue;
    }
    const value = raw[key];
    if (typeof value !== "string" || value.trim().length < 3) missing.push(key);
  }
  return missing;
}

async function main() {
  const index = await getKnowledgeBaseIndex();
  const promptById = new Map<string, string>();
  const promptOwners = new Map<string, string[]>();
  const scriptOwners = new Map<string, string[]>();
  const missingByField = new Map<string, number>();
  const failures: string[] = [];
  const placeholders: string[] = [];
  const generic: string[] = [];
  let parsed = 0;

  for (const file of index.files) {
    const stem = basename(file).replace(/\.json$/i, "");
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>;
    } catch {
      failures.push(`${stem}: invalid JSON`);
      continue;
    }
    parsed += 1;
    const id = typeof raw.id === "string" ? raw.id : stem;
    const code = typeof raw.code === "string" ? raw.code : "";
    const title = typeof raw.title === "string" ? raw.title : "";

    for (const key of [id, stem, code, title].filter((value) => value.trim().length > 1)) {
      const loaded = await loadKnowledgeBaseCaseFromDisk(key);
      if (!loaded || loaded.id !== id) {
        failures.push(`${id}: lookup "${key}" -> ${loaded?.id ?? "miss"}`);
        break;
      }
    }

    const script = typeof raw.patientPrompt === "string" ? raw.patientPrompt.trim() : "";
    if (!script || script.toLowerCase().startsWith(PLACEHOLDER)) placeholders.push(id);
    if (script) {
      const owners = scriptOwners.get(script) ?? [];
      owners.push(id);
      scriptOwners.set(script, owners);
    }

    for (const field of missingFields(raw)) {
      missingByField.set(field, (missingByField.get(field) ?? 0) + 1);
    }

    const loaded = await loadKnowledgeBaseCaseFromDisk(id);
    if (!loaded) {
      failures.push(`${id}: index miss after parse`);
      continue;
    }
    const prompt = promptFor(loaded);
    promptById.set(id, prompt);
    const owners = promptOwners.get(prompt) ?? [];
    owners.push(id);
    promptOwners.set(prompt, owners);

    const personaAt = prompt.lastIndexOf("ADESSO SEI SOLO QUESTO PAZIENTE");
    const condition = loaded.condition?.trim() ?? "";
    const setting = loaded.setting?.trim() ?? "";
    if (personaAt < 0) generic.push(`${id}: persona is not in the prompt`);
    else if (condition && !prompt.slice(personaAt).includes(condition)) {
      generic.push(`${id}: condition missing from the persona`);
    } else if (setting && !prompt.slice(personaAt).toUpperCase().includes(setting.replaceAll("_", " ").slice(0, 6))) {
      const labelHit =
        /Pronto Soccorso|Reparto di degenza|Ambulatorio|Guardia medica/i.test(prompt) ||
        prompt.includes(setting);
      if (!labelHit) generic.push(`${id}: setting missing from the prompt`);
    }
    if (/NON conosci la parola|Bellelli dice|sponde alzate/i.test(prompt) && !/Bellelli|sponde/i.test(loaded.description ?? "")) {
      generic.push(`${id}: canned example leaked into the prompt`);
    }
  }

  const duplicateScripts = [...scriptOwners.entries()].filter(([, ids]) => ids.length > 1);
  const duplicatePrompts = [...promptOwners.entries()].filter(([, ids]) => ids.length > 1);

  const bySpecialty = new Map<string, number>();
  for (const file of index.files) {
    const specialty = specialtyOf(file);
    bySpecialty.set(specialty, (bySpecialty.get(specialty) ?? 0) + 1);
  }

  console.log("=== AUDIT ===");
  console.log(`files indexed: ${index.files.length}`);
  console.log(`json parsed: ${parsed}`);
  console.log(`prompts built: ${promptById.size}`);
  console.log(`distinct prompts: ${promptOwners.size}`);
  console.log(`lookup failures: ${failures.length}`);
  console.log(`placeholder scripts: ${placeholders.length}`);
  console.log(`duplicate patientPrompt groups: ${duplicateScripts.length}`);
  console.log(`duplicate full prompts: ${duplicatePrompts.length}`);
  console.log(`generic-prompt flags: ${generic.length}`);
  console.log("missing fields:");
  for (const field of REQUIRED) {
    console.log(`  ${field}: ${missingByField.get(field) ?? 0}`);
  }
  console.log("by folder:");
  for (const [specialty, count] of [...bySpecialty.entries()].sort()) {
    console.log(`  ${specialty}: ${count}`);
  }
  if (failures.length) console.log("failures:\n" + failures.slice(0, 40).join("\n"));
  if (placeholders.length) console.log("placeholders: " + placeholders.slice(0, 20).join(", "));
  if (duplicateScripts.length) {
    console.log(
      "shared scripts:\n" +
        duplicateScripts
          .slice(0, 12)
          .map(([script, ids]) => `  ${ids.length} cases share: ${script.slice(0, 80)} [${ids.slice(0, 6).join(", ")}]`)
          .join("\n"),
    );
  }
  if (generic.length) console.log("generic:\n" + generic.slice(0, 20).join("\n"));

  const display = await loadKnowledgeBaseCaseFromDisk("CASE-EMAT-0");
  const emat = await loadKnowledgeBaseCaseFromDisk("EMAT-007");
  const slug = await loadKnowledgeBaseCaseFromDisk("facile_asma_lieve");
  const intmed = await loadKnowledgeBaseCaseFromDisk("INTMED-005");
  console.log(
    `alias check: CASE-EMAT-0=${display?.id ?? "unresolved (expected when the prefix collides)"}; EMAT-007=${emat?.id ?? "MISS"}; slug=${slug?.id ?? "MISS"}; INTMED-005=${intmed?.id ?? "MISS"}`,
  );

  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    console.log("LIVE: skipped, OPENAI_API_KEY missing");
    return;
  }

  const only = new Set(process.argv.slice(2).map((id) => id.toUpperCase()));
  const sample = new Map<string, ClinicalCase>();
  for (const file of index.files) {
    const specialty = specialtyOf(file);
    const loaded = await loadKnowledgeBaseCaseFromDisk(basename(file).replace(/\.json$/i, ""));
    if (!loaded?.condition || !loaded.description) continue;
    if (only.size > 0) {
      if (only.has(loaded.id.toUpperCase())) sample.set(loaded.id, loaded);
      continue;
    }
    if (sample.has(specialty)) continue;
    sample.set(specialty, loaded);
  }

  console.log("\n=== LIVE gpt-6-luna ===");
  for (const [specialty, clinical] of sample) {
    const prompt = promptById.get(clinical.id) ?? promptFor(clinical);
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-6-luna",
        reasoning_effort: "none",
        messages: [
          { role: "developer", content: prompt },
          { role: "user", content: "buongiorno cosa succede?" },
        ],
      }),
    });
    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };
    const text = body.choices?.[0]?.message?.content?.trim() || body.error?.message || `HTTP ${response.status}`;
    console.log(`\n[${specialty}] ${clinical.id} | ${clinical.condition}`);
    console.log(text);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
