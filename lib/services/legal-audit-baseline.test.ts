/**
 * La CTU valuta anche senza chunk RAG di specialità e non assegna 100 a un fallback tecnico.
 *
 *   npx tsx --test lib/services/legal-audit-baseline.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createLegalAuditTechnicalFallback,
  runLegalAudit,
  type LegalAuditResult,
} from "@/lib/services/legal-audit-service";

const FIVE_SECTIONS = [
  "=== ANAMNESI ED ESAME OBIETTIVO ESSENZIALI ===",
  "=== RISCONTRI DIAGNOSTICI E RAGIONAMENTO CLINICO ===",
  "=== DIAGNOSI, TERAPIA E CONDOTTA ===",
  "=== INFORMAZIONE AL PAZIENTE, CONSENSO, FOLLOW-UP E RED FLAGS ===",
  "=== CHIUSURA FORMALE (DATA/ORA E QUALIFICA) ===",
].join("\n");

function evaluated(score: number): LegalAuditResult {
  return {
    status: "EVALUATED",
    overallVerdict: "PARTIALLY_PROTECTED",
    complianceScore: score,
    executiveSummary: "Referto incompleto: manca il consenso e la chiusura formale.",
    comparativeAnalysis: [
      {
        userAction: "Referto senza consenso.",
        requiredAction: "Tracciare informazione e consenso, L. 219/2017.",
        isProtected: false,
        explanation: "Il blocco informativo è assente.",
        sourceQuote: "Legge 219/2017",
        faultCategory: "DIFETTO_CONSENSO",
      },
      {
        userAction: "Anamnesi scritta.",
        requiredAction: "Documentare anamnesi e allergie.",
        isProtected: true,
        explanation: "La prima sezione è presente.",
        sourceQuote: "art. 476 c.p.",
        faultCategory: "OTTIMALE",
      },
    ],
    uncoveredAreas: ["Chiusura formale assente"],
    guidelineCitations: ["Legge 24/2017, art. 5"],
  };
}

describe("runLegalAudit senza chunk di specialità", () => {
  it("valuta il referto a cinque sezioni e non usa il corto-circuito vuoto", async () => {
    let seen = "";
    const result = await runLegalAudit(
      {
        legalChunks: [],
        referenceGuidelines: ["Linee guida ESC di riferimento"],
        caseNotes: "Scudo Gelli: tracciare il consenso.",
        simulationLog: {
          chatHistory: [{ role: "user", content: "Da quando ha il dolore?" }],
          requestedExams: [],
          clinicalSummary: "Dolore toracico, controllo a 48 ore.",
          reportText: FIVE_SECTIONS,
          finalDiagnosis: "Angina instabile",
        },
      },
      {
        generate: async ({ prompt }) => {
          seen = prompt;
          return evaluated(62);
        },
      },
    );

    assert.equal(result.status, "EVALUATED");
    assert.equal(result.sourceBasis, "NORMATIVA_NAZIONALE_BASELINE");
    assert.notEqual(result.complianceScore, 100);
    assert.match(seen, /ANAMNESI ED ESAME OBIETTIVO ESSENZIALI/);
    assert.match(seen, /RISCONTRI DIAGNOSTICI E RAGIONAMENTO CLINICO/);
    assert.match(seen, /DIAGNOSI, TERAPIA E CONDOTTA/);
    assert.match(seen, /INFORMAZIONE AL PAZIENTE, CONSENSO, FOLLOW-UP E RED FLAGS/);
    assert.match(seen, /CHIUSURA FORMALE/);
    assert.match(seen, /RELAZIONE_DI_DIMISSIONE/);
    assert.match(seen, /Legge 24\/2017/);
    assert.match(seen, /219\/2017/);
    assert.match(seen, /476/);
    assert.match(seen, /Normativa nazionale baseline/);
  });

  it("un fallback tecnico non produce mai 100", async () => {
    assert.notEqual(createLegalAuditTechnicalFallback().complianceScore, 100);
    const failed = await runLegalAudit(
      {
        legalChunks: [],
        simulationLog: {
          chatHistory: [],
          requestedExams: [],
          reportText: FIVE_SECTIONS,
          clinicalSummary: "Diario presente.",
        },
      },
      {
        generate: async () => {
          throw new Error("timeout");
        },
      },
    );
    assert.notEqual(failed.complianceScore, 100);
    assert.equal(failed.overallVerdict, "NOT_EVALUABLE");
    assert.ok(failed.complianceScore <= 0);
  });
});
