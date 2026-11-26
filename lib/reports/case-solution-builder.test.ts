/**
 * Ogni caso del catalogo produce una soluzione non vuota, assente dal referto pubblico.
 *
 *   npx tsx --test lib/reports/case-solution-builder.test.ts
 */
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { AUTHORED_CASE_REGISTRY } from "@/lib/data/cases/registry-store";
import {
  buildCaseSolutionPayload,
  caseSolutionIsComplete,
  type CaseSolutionSource,
} from "@/lib/reports/case-solution-builder";
import { toPublicRefertoFields } from "@/lib/services/unified-simulation-trace";

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

function isClinicalCase(row: Record<string, unknown>): boolean {
  if (typeof row.id !== "string" || !row.id.trim()) return false;
  return (
    typeof row.pastMedicalHistory === "string" ||
    typeof row.correctSolution === "string" ||
    typeof row.diagnosis === "string" ||
    typeof row.condition === "string" ||
    Array.isArray(row.goldStandardPath)
  );
}

describe("buildCaseSolutionPayload su tutto il catalogo", () => {
  it("restituisce una soluzione formata per ogni caso JSON e del registry", async () => {
    const root = path.join(process.cwd(), "knowledge_base");
    const files = await walkJson(root);
    const cases: Array<{ id: string; source: CaseSolutionSource }> = [];
    for (const file of files) {
      let raw: unknown;
      try {
        raw = JSON.parse(await readFile(file, "utf8"));
      } catch {
        continue;
      }
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      const row = raw as Record<string, unknown>;
      if (!isClinicalCase(row)) continue;
      cases.push({ id: String(row.id), source: row as CaseSolutionSource });
    }
    for (const item of AUTHORED_CASE_REGISTRY) {
      cases.push({ id: item.id, source: item });
    }

    assert.ok(cases.length > 50, `catalogo troppo piccolo: ${cases.length}`);
    const failures: string[] = [];
    for (const item of cases) {
      const payload = buildCaseSolutionPayload(item.source);
      if (!caseSolutionIsComplete(payload)) failures.push(item.id);
    }
    assert.deepEqual(failures, []);
  });

  it("non espone la soluzione nel referto pubblico", () => {
    const pub = toPublicRefertoFields({
      correctSolution: "STEMI",
      caseSolution: { diagnosis: "STEMI" },
      scoreWaterfall: { clinica: [] },
    });
    assert.equal("correctSolution" in pub, false);
    assert.equal("caseSolution" in pub, false);
    assert.equal(pub.scoreWaterfall != null, true);
  });
});
