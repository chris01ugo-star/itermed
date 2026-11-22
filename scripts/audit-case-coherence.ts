/**
 * Read-only coherence audit for knowledge-base cases.
 *
 *   npx tsx scripts/audit-case-coherence.ts
 *
 * Flags:
 *   a) demographics missing or discordant with title, script, or history
 *   b) title or description with a diagnostic spoiler or a guideline/tariff citation
 *   c) anamnesis clues written as examiner instructions
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  resolvePatientProfile,
  sanitizeCluesForPatient,
  type PatientClueInput,
} from "@/lib/cases/resolve-patient-profile";

const SPOILER_RE =
  /\b(GOLD|ELN|ESC\b|AHA|NICE|SNLG|BCR|ABL\d*|MRD|nomenclatore|spreco\s+SSN|tariff\w*|linee?\s+guida|philadelphia|leucemia|linfoblastica|blasti|STEMI|NSTEMI|fibrillazione\s+atriale)\b/i;

type CaseJson = {
  id?: string;
  title?: string;
  description?: string;
  patientPrompt?: string;
  pastMedicalHistory?: string;
  presentation?: string;
  setting?: string;
  diagnosis?: string;
  condition?: string;
  correctSolution?: string;
  baselineExamFindings?: Record<string, unknown>;
  anamnesisQuestions?: PatientClueInput[];
};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const absolute = path.join(dir, entry);
    const info = statSync(absolute);
    if (info.isDirectory()) walk(absolute, out);
    else if (entry.endsWith(".json") && absolute.includes(`${path.sep}cases${path.sep}`)) out.push(absolute);
  }
  return out;
}

function main() {
  const root = path.join(process.cwd(), "knowledge_base");
  const files = walk(root);
  const missingDemographics: string[] = [];
  const discordant: string[] = [];
  const spoilerCopy: string[] = [];
  const examinerClues: string[] = [];

  for (const file of files) {
    const raw = JSON.parse(readFileSync(file, "utf8")) as CaseJson;
    const id = raw.id ?? path.basename(file, ".json");
    const demo = raw.baselineExamFindings?.demographics;
    const hasDemo = demo != null && typeof demo === "object";
    const profile = resolvePatientProfile({
      id,
      title: raw.title,
      description: raw.description,
      patientPrompt: raw.patientPrompt,
      pastMedicalHistory: raw.pastMedicalHistory,
      presentation: raw.presentation,
      setting: raw.setting,
      baselineExamFindings: raw.baselineExamFindings,
      correctSolution: raw.correctSolution,
      diagnosis: raw.diagnosis,
      condition: raw.condition,
    });
    if (!hasDemo || profile.coherenceNotes.some((note) => note.startsWith("sex missing") || note.startsWith("age missing"))) {
      missingDemographics.push(id);
    }
    if (profile.coherenceNotes.some((note) => /disagrees|overridden/.test(note))) {
      discordant.push(`${id}: ${profile.coherenceNotes.join(" | ")}`);
    }
    const title = raw.title ?? "";
    const description = raw.description ?? "";
    if (SPOILER_RE.test(title) || SPOILER_RE.test(description)) {
      spoilerCopy.push(id);
    }
    const clues = raw.anamnesisQuestions ?? [];
    const kept = sanitizeCluesForPatient(clues);
    if (clues.length > 0 && kept.length < clues.length) examinerClues.push(id);
  }

  const unique = (rows: string[]) => [...new Set(rows)];
  const report = {
    scanned: files.length,
    missingOrIncompleteDemographics: unique(missingDemographics).length,
    discordantDemographics: unique(discordant).length,
    spoilerTitleOrDescription: unique(spoilerCopy).length,
    examinerClueCases: unique(examinerClues).length,
    discordantSample: unique(discordant).slice(0, 12),
    spoilerSample: unique(spoilerCopy).slice(0, 20),
    examinerSample: unique(examinerClues).slice(0, 20),
  };
  console.log(JSON.stringify(report, null, 2));
}

main();
