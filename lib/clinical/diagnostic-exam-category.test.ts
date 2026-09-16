/**
 *   npx tsx --test lib/clinical/diagnostic-exam-category.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  catalogForChartSection,
  classifyDiagnosticExam,
  classifyExamByName,
  partitionExamsByChartSection,
  type ChartCatalogMacro,
} from "@/lib/clinical/diagnostic-exam-category";

const CATALOG: ChartCatalogMacro[] = [
  {
    id: "lab",
    label: "Laboratorio",
    groups: [{ id: "ematologia", label: "Ematologia", exams: [{ id: "emocromo", name: "Emocromo" }] }],
  },
  {
    id: "img",
    label: "Immagini",
    groups: [
      {
        id: "rad-eco",
        label: "Radiologia",
        exams: [
          { id: "rx-torace", name: "RX Torace (2 proiezioni)" },
          { id: "ecg", name: "ECG (riposo/sforzo/Holter)" },
        ],
      },
      {
        id: "avanzate",
        label: "TC / RM",
        exams: [{ id: "pet-tc", name: "PET-TC" }],
      },
    ],
  },
  {
    id: "strum",
    label: "Strumentale",
    groups: [
      {
        id: "funzionale",
        label: "Funzionale",
        exams: [
          { id: "spirometria", name: "Spirometria (semplice/globale)" },
          { id: "eeg", name: "Elettroencefalogramma (EEG)" },
        ],
      },
    ],
  },
  {
    id: "endo",
    label: "Endoscopia",
    groups: [
      {
        id: "endo-biopsie",
        label: "Endoscopia",
        exams: [{ id: "egds", name: "Esofagogastroduodenoscopia (EGDS)" }],
      },
    ],
  },
];

describe("diagnostic-exam-category", () => {
  it("classifies imaging vs strumentale from names even when mixed in Imaging", () => {
    assert.equal(classifyExamByName({ id: "x", name: "Elettrocardiogramma 12 derivazioni" }), "INSTRUMENTAL");
    assert.equal(classifyExamByName({ id: "x", name: "RX torace" }), "IMAGING");
    assert.equal(classifyExamByName({ id: "ecg", name: "ECG" }), "INSTRUMENTAL");
    assert.equal(classifyExamByName({ id: "x", name: "Ecocardiografia TT" }), "INSTRUMENTAL");
    assert.equal(classifyExamByName({ id: "x", name: "Ecografia addome" }), "IMAGING");
    assert.equal(classifyExamByName({ id: "x", name: "Spirometria globale" }), "INSTRUMENTAL");
    assert.equal(classifyExamByName({ id: "x", name: "Colonscopia" }), "ENDOSCOPY");
  });

  it("heuristic overrides a dirty catalog row (ECG stored under Imaging)", () => {
    assert.equal(
      classifyDiagnosticExam({ id: "ecg", name: "ECG (riposo/sforzo/Holter)" }, CATALOG),
      "INSTRUMENTAL",
    );
    assert.equal(
      classifyDiagnosticExam({ id: "rx-torace", name: "RX Torace (2 proiezioni)" }, CATALOG),
      "IMAGING",
    );
  });

  it("splits the Imaging tab from Strumentale including misplaced ECG", () => {
    const imaging = catalogForChartSection(CATALOG, "imaging");
    const instrumental = catalogForChartSection(CATALOG, "instrumental");

    const imagingIds = imaging.flatMap((m) => m.groups.flatMap((g) => g.exams.map((e) => e.id)));
    const instrumentalIds = instrumental.flatMap((m) =>
      m.groups.flatMap((g) => g.exams.map((e) => e.id)),
    );

    assert.deepEqual(imagingIds.sort(), ["pet-tc", "rx-torace"].sort());
    assert.ok(imaging.every((m) => m.id === "img"));
    assert.ok(!imagingIds.includes("ecg"));

    assert.ok(instrumentalIds.includes("ecg"));
    assert.ok(instrumentalIds.includes("spirometria"));
    assert.ok(instrumentalIds.includes("eeg"));
    assert.ok(instrumentalIds.includes("egds"));
    assert.ok(!instrumentalIds.includes("rx-torace"));
    assert.ok(instrumental.some((m) => m.id === "strum"));
    assert.ok(instrumental.some((m) => m.id === "endo"));
  });

  it("partitions requested exams for the Referto lists", () => {
    const split = partitionExamsByChartSection(
      [
        { id: "rx-torace", name: "RX Torace" },
        { id: "ecg", name: "ECG" },
        { id: "emocromo", name: "Emocromo" },
      ],
      CATALOG,
    );
    assert.equal(split.imaging.map((e) => e.id).join(), "rx-torace");
    assert.equal(split.instrumental.map((e) => e.id).join(), "ecg");
    assert.equal(split.lab.map((e) => e.id).join(), "emocromo");
  });
});
