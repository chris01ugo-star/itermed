/**
 * Citazioni SNLG/ISS e art. 5 L. 24/2017 nel prompt CTU.
 *
 *   npx tsx --test lib/services/legal-audit-guidelines.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapLegalAuditToDTO } from "@/lib/mappers/legal-audit-mapper";
import {
  GELLI_ART_5_CITATION,
  LEGAL_AUDIT_SYSTEM_PROMPT,
  LegalAuditResultSchema,
  resolveReferenceGuidelines,
  withGuidelineCitations,
  type LegalAuditResult,
} from "@/lib/services/legal-audit-service";

const evaluated: LegalAuditResult = {
  status: "EVALUATED",
  overallVerdict: "PARTIALLY_PROTECTED",
  complianceScore: 70,
  executiveSummary: "Operato parzialmente aderente alle raccomandazioni.",
  comparativeAnalysis: [
    {
      userAction: "ECG eseguito.",
      requiredAction: "ECG entro 10 minuti.",
      isProtected: true,
      explanation: "Tempestivo.",
      sourceQuote: "",
    },
  ],
  uncoveredAreas: [],
};

describe("reference guidelines for Gelli-Bianco art. 5", () => {
  it("prefers the case field, then authored citations, then the specialty", () => {
    const explicit = resolveReferenceGuidelines({
      referenceGuidelines: ["Linee Guida ESC 2023 per SCA"],
      ragSourceRefs: ["Rif. ignorato.pdf"],
      specialty: "cardiologia",
    });
    assert.equal(explicit[0], GELLI_ART_5_CITATION);
    assert.ok(explicit.includes("Linee Guida ESC 2023 per SCA"));
    assert.equal(explicit.some((line) => line.includes("ignorato")), false);

    const fromCase = resolveReferenceGuidelines({
      ragSourceRefs: ["2023 ESC sindromi coronariche acute"],
      specialty: "cardiologia",
    });
    assert.ok(fromCase.includes("2023 ESC sindromi coronariche acute"));
    assert.equal(fromCase.some((line) => line.includes("ESC/AHA vigenti")), false);

    const fallback = resolveReferenceGuidelines({ specialty: "Cardiologia" });
    assert.ok(fallback.some((line) => line.includes("SNLG")));
    assert.ok(fallback.some((line) => line.includes("ESC/AHA")));
  });

  it("keeps the model citations and fills them when the model omits the field", () => {
    const kept = withGuidelineCitations(
      { ...evaluated, guidelineCitations: ["ESC 2023 SCA"] },
      ["Linee Guida ESC 2023 per SCA"],
    );
    assert.deepEqual(kept.guidelineCitations, ["ESC 2023 SCA"]);

    const filled = withGuidelineCitations(evaluated, ["Linee Guida ESC 2023 per SCA"]);
    assert.deepEqual(filled.guidelineCitations, ["Linee Guida ESC 2023 per SCA"]);
  });

  it("requires guidelineCitations in the CTU schema and the art. 5 instruction in the prompt", () => {
    const withCitations = LegalAuditResultSchema.safeParse({
      ...evaluated,
      guidelineCitations: ["Linee Guida ESC 2023 per SCA"],
    });
    const withoutCitations = LegalAuditResultSchema.safeParse(evaluated);
    assert.equal(withCitations.success, true);
    assert.equal(withoutCitations.success, true);
    assert.match(
      LEGAL_AUDIT_SYSTEM_PROMPT,
      /Ai sensi dell'art\. 5 della Legge 24\/2017 \(Gelli-Bianco\), devi valutare se l'operato si discosta dalle raccomandazioni ufficiali\. Se fornite, CITA SEMPRE le linee guida di riferimento nella tua analisi\./,
    );
  });

  it("exposes the citations on the legal report DTO", () => {
    const dto = mapLegalAuditToDTO({
      ...evaluated,
      guidelineCitations: ["Legge 24/2017 (Gelli-Bianco), art. 5", "SNLG — ISS"],
    });
    assert.deepEqual(dto.guidelineCitations, [
      "Legge 24/2017 (Gelli-Bianco), art. 5",
      "SNLG — ISS",
    ]);
  });
});
