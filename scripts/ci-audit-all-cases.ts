/**
 * Unified CI audit: every `KnowledgeBaseCase` row in PostgreSQL.
 *
 * - Zod-parse 100% of `caseData` payloads (`knowledgeBaseCaseSchema`)
 * - Playability gate (`assertPlayableCase`: gold path + vitals)
 * - D-RIME initial vector integrity (T_0, A_0, D_0) in [0, 100]
 * - RAG sources present (`ragSources` and/or `escCitations`)
 *
 * Exit 0 if the full catalog is valid; exit 1 with a per-case report otherwise.
 *
 *   npx tsx scripts/ci-audit-all-cases.ts
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { assertPlayableCase } from "@/lib/cases/case-import-schema";
import {
  PatientProfileSchema,
  knowledgeBaseCaseSchema,
  type KnowledgeBaseCase,
  type PatientProfile,
} from "@/lib/cases/knowledge-base-case-schema";
import { prisma } from "@/lib/prisma";
import { initializePatientState, parsePatientProfile } from "@/lib/reports/d-rime-engine";
import { applyIntentSequence, clampAffectState } from "@/lib/services/d-rime-fsm";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const EXPECTED_TOTAL = 90;
const EXPECTED_PER_SPECIALTY: Record<string, number> = {
  cardiologia: 30,
  pneumologia: 30,
  gastroenterologia: 30,
};

type AuditFailure = {
  id: string;
  specialty: string;
  issues: string[];
};

function formatZodIssues(error: { issues: Array<{ path: (string | number)[]; message: string }> }): string[] {
  return error.issues.slice(0, 6).map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "root";
    return `zod.${path}: ${issue.message}`;
  });
}

function isUnitInterval(n: number): boolean {
  return Number.isFinite(n) && n >= 0 && n <= 100;
}

function ragCitationCount(value: unknown): number {
  if (Array.isArray(value)) return value.filter((row) => row && typeof row === "object").length;
  return 0;
}

function resolvePatientProfile(
  parsed: KnowledgeBaseCase,
  storedProfile: unknown,
): PatientProfile | null {
  if (parsed.patientProfile) return parsed.patientProfile;
  const fromColumn = parsePatientProfile(storedProfile);
  if (!fromColumn) return null;
  const checked = PatientProfileSchema.safeParse(fromColumn);
  return checked.success ? checked.data : null;
}

function dRimeInitialIssues(parsed: KnowledgeBaseCase, storedProfile: unknown): string[] {
  const issues: string[] = [];
  const specialtyRequiresProfile =
    parsed.specialty === "pneumologia" || parsed.specialty === "gastroenterologia";
  const profile = resolvePatientProfile(parsed, storedProfile);

  if (specialtyRequiresProfile && !profile) {
    issues.push("D-RIME: patientProfile assente (obbligatorio per pneumologia/gastroenterologia)");
    return issues;
  }

  if (parsed.patientProfile) {
    const checked = PatientProfileSchema.safeParse(parsed.patientProfile);
    if (!checked.success) {
      issues.push(...formatZodIssues(checked.error).map((s) => s.replace(/^zod\./, "D-RIME.patientProfile.")));
      return issues;
    }
  }

  try {
    const initial = clampAffectState(initializePatientState(profile));
    const { trust: t0, anxiety: a0, defensiveness: d0 } = initial;
    if (!isUnitInterval(t0)) issues.push(`D-RIME: T_0 fuori range [0,100] (${String(t0)})`);
    if (!isUnitInterval(a0)) issues.push(`D-RIME: A_0 fuori range [0,100] (${String(a0)})`);
    if (!isUnitInterval(d0)) issues.push(`D-RIME: D_0 fuori range [0,100] (${String(d0)})`);

    if (profile?.healthLiteracy === "CYBERCHONDRIA_AI") {
      if (t0 > 50) issues.push(`D-RIME: CYBERCHONDRIA_AI T_0 troppo alta (${t0})`);
      if (a0 < 70) issues.push(`D-RIME: CYBERCHONDRIA_AI A_0 troppo bassa (${a0})`);
      if (d0 < 70) issues.push(`D-RIME: CYBERCHONDRIA_AI D_0 troppo bassa (${d0})`);
    }

    const stepped = applyIntentSequence(initial, ["NEUTRAL"], "standard");
    if (!isUnitInterval(stepped.final.trust) || !isUnitInterval(stepped.final.anxiety) || !isUnitInterval(stepped.final.defensiveness)) {
      issues.push("D-RIME: FSM NEUTRAL da (T_0,A_0,D_0) ha prodotto valori fuori [0,100]");
    }
  } catch (error) {
    issues.push(`D-RIME throw: ${error instanceof Error ? error.message : String(error)}`);
  }

  return issues;
}

function ragIssues(parsed: KnowledgeBaseCase, storedRag: unknown): string[] {
  const issues: string[] = [];
  const fromPayload = parsed.escCitations.length;
  const fromColumn = ragCitationCount(storedRag);
  if (fromPayload < 1 && fromColumn < 1) {
    issues.push("RAG: nessuna fonte (escCitations e ragSources vuoti)");
  }
  for (const [i, citation] of parsed.escCitations.entries()) {
    if (!citation.source?.trim()) issues.push(`RAG: escCitations[${i}].source vuoto`);
    if (!citation.quote?.trim() || citation.quote.trim().length < 20) {
      issues.push(`RAG: escCitations[${i}].quote insufficiente`);
    }
  }
  if (!parsed.guidelineRef?.trim()) issues.push("RAG: guidelineRef assente");
  return issues;
}

function playableIssues(parsed: KnowledgeBaseCase): string[] {
  const result = assertPlayableCase({
    title: parsed.title,
    description: parsed.description,
    difficulty: parsed.difficulty,
    goldStandardPath: parsed.goldStandardPath,
    baselineExamFindings: parsed.baselineExamFindings,
    correctSolution: parsed.correctSolution,
    patientPrompt: parsed.patientPrompt,
  });
  if (result.ok) return [];
  return result.issues.map((issue) => `playable.${issue.path}: ${issue.message}`);
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL && !process.env.DATABASE_POOL_URL && !process.env.POSTGRES_PRISMA_URL) {
    console.error("[ci-audit] FAIL: DATABASE_URL (o DATABASE_POOL_URL) è obbligatorio.");
    console.error("  Locale: imposta .env.local");
    console.error("  GitHub Actions: secret DATABASE_URL (Neon pooled).");
    process.exit(1);
  }

  const rows = await prisma.knowledgeBaseCase.findMany({
    orderBy: [{ specialty: "asc" }, { id: "asc" }],
    select: {
      id: true,
      specialty: true,
      title: true,
      patientProfile: true,
      caseData: true,
      ragSources: true,
    },
  });

  console.log("----------------------------------------------------");
  console.log("[ci-audit] KnowledgeBaseCase continuous audit");
  console.log("----------------------------------------------------");
  console.log(`Rows loaded     : ${rows.length}`);

  const failures: AuditFailure[] = [];
  const bySpecialty = new Map<string, number>();

  for (const row of rows) {
    bySpecialty.set(row.specialty, (bySpecialty.get(row.specialty) ?? 0) + 1);
    const issues: string[] = [];

    const parsed = knowledgeBaseCaseSchema.safeParse(row.caseData);
    if (!parsed.success) {
      issues.push(...formatZodIssues(parsed.error));
      failures.push({ id: row.id, specialty: row.specialty, issues });
      continue;
    }

    const kb = parsed.data;
    if (kb.id !== row.id) issues.push(`id mismatch: caseData.id=${kb.id} row.id=${row.id}`);
    if (kb.specialty !== row.specialty) {
      issues.push(`specialty mismatch: caseData=${kb.specialty} row=${row.specialty}`);
    }

    issues.push(...playableIssues(kb));
    issues.push(...dRimeInitialIssues(kb, row.patientProfile));
    issues.push(...ragIssues(kb, row.ragSources));

    if (issues.length > 0) {
      failures.push({ id: row.id, specialty: row.specialty, issues });
    }
  }

  for (const [specialty, count] of [...bySpecialty.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const expected = EXPECTED_PER_SPECIALTY[specialty];
    const marker = expected != null && count === expected ? "OK" : "MISMATCH";
    console.log(`  ${specialty.padEnd(20)} ${count}${expected != null ? `/${expected}` : ""}  ${marker}`);
    if (expected != null && count !== expected) {
      failures.push({
        id: `__catalog__${specialty}`,
        specialty,
        issues: [`attesi ${expected} casi, trovati ${count}`],
      });
    }
  }

  if (rows.length !== EXPECTED_TOTAL) {
    failures.push({
      id: "__catalog__total",
      specialty: "*",
      issues: [`attesi ${EXPECTED_TOTAL} casi totali, trovati ${rows.length}`],
    });
  }

  console.log("----------------------------------------------------");
  const passed = rows.length - failures.filter((f) => !f.id.startsWith("__catalog__")).length;
  console.log(`Schema+playable+D-RIME+RAG : ${passed}/${rows.length} casi`);
  console.log(`Failures                   : ${failures.length}`);

  if (failures.length > 0) {
    console.error("----------------------------------------------------");
    console.error("[ci-audit] FAIL — casi corrotti / catalogo incompleto:");
    for (const fail of failures) {
      console.error(`  ✗ ${fail.id} (${fail.specialty})`);
      for (const issue of fail.issues) {
        console.error(`      - ${issue}`);
      }
    }
    console.error("----------------------------------------------------");
    process.exitCode = 1;
    return;
  }

  console.log("----------------------------------------------------");
  console.log(`[ci-audit] PASS — ${EXPECTED_TOTAL}/${EXPECTED_TOTAL} casi validi`);
  console.log("----------------------------------------------------");
}

main()
  .catch((error) => {
    console.error("[ci-audit] FAIL", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
