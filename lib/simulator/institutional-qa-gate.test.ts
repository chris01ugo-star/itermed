/**
 * Every authored case keeps a patient prompt that can sustain a long interview.
 *
 *   npx tsx --test lib/simulator/institutional-qa-gate.test.ts
 */
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { AUTHORED_CASE_REGISTRY } from "@/lib/data/cases/registry-store";
import { buildPatientSystemPrompt } from "@/lib/simulator/patient-system-prompt";
import { sanitizePatientUtterance } from "@/lib/simulator/patient-output-sanitizer";

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

describe("institutional qa gate", () => {
  it("passes every catalog case without a robotic opening or an unfilled slot", async () => {
    const files = await walkJson(path.join(process.cwd(), "knowledge_base"));
    const seen = new Set<string>();
    const failures: string[] = [];
    const cases: Array<{ id: string; patientPrompt: string; presentation?: string; description?: string; pastMedicalHistory?: string }> = [];

    for (const file of files) {
      let raw: unknown;
      try {
        raw = JSON.parse(await readFile(file, "utf8"));
      } catch {
        continue;
      }
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      const row = raw as { id?: string; patientPrompt?: string; presentation?: string; description?: string; pastMedicalHistory?: string };
      if (typeof row.id !== "string" || typeof row.patientPrompt !== "string") continue;
      seen.add(row.id);
      cases.push({
        id: row.id,
        patientPrompt: row.patientPrompt,
        presentation: row.presentation,
        description: row.description,
        pastMedicalHistory: row.pastMedicalHistory,
      });
    }
    for (const item of AUTHORED_CASE_REGISTRY) {
      if (seen.has(item.id)) continue;
      cases.push({
        id: item.id,
        patientPrompt: item.patientPrompt,
        presentation: item.presentation,
        description: item.description,
        pastMedicalHistory: item.pastMedicalHistory,
      });
    }

    assert.ok(cases.length >= 327, `catalogo ${cases.length}, attesi almeno 327`);
    for (const item of cases) {
      const prompt = buildPatientSystemPrompt({
        patientAge: "60",
        patientSex: "M",
        chiefComplaint: item.presentation || item.description || item.patientPrompt,
        clinicalStory: item.description || item.patientPrompt,
        presentation: item.presentation,
        pastMedicalHistory: item.pastMedicalHistory,
        roleplayScript: item.patientPrompt,
        sourceDescription: item.description,
        vitalSigns: "{}",
        patientStress: 20,
        trueDiagnosis: "",
        abnormalExams: "",
        clinicalSignsJson: "[]",
        painNrs: null,
        currentTurn: 4,
        completedExamLabels: ["Prelievo"],
      });
      if (/\[sintomi attuali\]/i.test(prompt) || /non sto bene, e per questo sono venut/i.test(prompt)) {
        failures.push(item.id);
      }
      if (!prompt.includes("VERITÀ ANAMNESTICA VINCOLANTE") || !prompt.includes("STATO ATTUALE DELLA VISITA")) {
        failures.push(`${item.id}:anchor`);
      }
      const later = sanitizePatientUtterance(
        "Non bevo alcol, non fumo e prendo la terapia che mi ha dato il medico di base.",
        { turn: 4, symptomPhrase: "dolore" },
      );
      if (later !== "Non bevo alcol, non fumo e prendo la terapia che mi ha dato il medico di base.") {
        failures.push(`${item.id}:sanitizer`);
      }
    }
    assert.deepEqual(failures, []);
  });
});
