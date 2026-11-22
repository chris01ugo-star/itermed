import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  finalizeClinicalExamReport,
  readGeneratedExamReport,
  stripNonClinicalAnchors,
} from "@/lib/simulator/exam-report";

describe("exam-report anchors", () => {
  it("keeps the pathologic value and drops SSN waste, tariffs and guideline citations", () => {
    const cleaned = stripNonClinicalAnchors(
      "PCR 180 mg/L. Esame non di prima intenzione, spreco SSN. Codice nomenclatore 90.12, tariffa €10. Come scrive GOLD, non è di prima scelta.",
    );
    assert.match(cleaned, /PCR 180 mg\/L/);
    assert.doesNotMatch(cleaned, /spreco ssn|nomenclatore|tariffa|GOLD/i);
  });

  it("reads only engine-generated overrides", () => {
    assert.equal(readGeneratedExamReport({ finding: "PCR 12" }), null);
    const stored = readGeneratedExamReport({
      generatedByEngine: true,
      examId: "pcr-pct",
      title: "PCR e PCT",
      category: "lab",
      isAbnormal: true,
      summary: "Flogosi sistemica.",
      parameters: [
        {
          name: "PCR",
          value: "180",
          unit: "mg/L",
          referenceRange: "< 5",
          flag: "H",
        },
      ],
      sections: null,
      formattedText: "PCR 180 mg/L.",
      finding: "PCR 180 mg/L.",
    });
    assert.equal(stored?.examId, "pcr-pct");
    assert.equal(stored?.parameters?.[0]?.flag, "H");
  });

  it("forces the catalog category and drops therapeutic leaks from the summary", () => {
    const report = finalizeClinicalExamReport(
      {
        title: "Emogasanalisi",
        category: "other",
        isAbnormal: false,
        summary: "Acidosi lattica. Si consiglia di somministrare liquidi.",
        parameters: [
          {
            name: "pH",
            value: "7,28",
            unit: "",
            referenceRange: "7,35-7,45",
            flag: "L",
          },
        ],
        sections: null,
        formattedText: "pH 7,28. Si consiglia terapia.",
      },
      { examId: "ega", examName: "Emogasanalisi arteriosa (EGA)", category: "ega" },
    );
    assert.equal(report.category, "ega");
    assert.equal(report.isAbnormal, true);
    assert.doesNotMatch(report.summary, /si consiglia/i);
    assert.doesNotMatch(report.formattedText, /si consiglia/i);
    assert.equal(report.parameters?.[0]?.value, "7,28");
  });
});
