/**
 * Pannelli di laboratorio standard. Il referto a schermo parte dai valori
 * fisiologici e sostituisce solo i parametri che il caso dichiara alterati.
 */

export type LabPanelCaseValue = {
  finding?: string | null;
  normalFinding?: string | null;
  parameters?: Record<string, string | number | null> | null;
  panel?: Record<string, string | number | null> | null;
  values?: Record<string, string | number | null> | null;
};

type QualitativeHint = { pattern: RegExp; line: string };

type PanelParameter = {
  id: string;
  aliases: string[];
  label: string;
  unit: string;
  normal: string;
  numeric: RegExp[];
  qualitative: QualitativeHint[];
  componentExamIds?: string[];
};

type StandardLabPanel = {
  ids: string[];
  parameters: PanelParameter[];
};

const EGA_PANEL: StandardLabPanel = {
  ids: ["ega", "emogas", "emogasanalisi", "abg"],
  parameters: [
    {
      id: "ph",
      aliases: ["ph"],
      label: "pH",
      unit: "",
      normal: "pH 7.40",
      numeric: [/\bph\s*[:=]?\s*(\d[.,]\d{1,3})\b/i],
      qualitative: [
        { pattern: /acidos/i, line: "pH ridotto (acidosi)" },
        { pattern: /alcalos/i, line: "pH aumentato (alcalosi)" },
      ],
    },
    {
      id: "pco2",
      aliases: ["pco2", "paco2"],
      label: "pCO2",
      unit: "mmHg",
      normal: "pCO2 40 mmHg",
      numeric: [/\bp\s*a?\s*co2\s*[:=]?\s*(\d{2}(?:[.,]\d+)?)\b/i],
      qualitative: [
        { pattern: /ipercapn/i, line: "pCO2 aumentata (ipercapnia)" },
        { pattern: /ipocapn/i, line: "pCO2 ridotta (ipocapnia)" },
      ],
    },
    {
      id: "po2",
      aliases: ["po2", "pao2"],
      label: "pO2",
      unit: "mmHg",
      normal: "pO2 95 mmHg",
      numeric: [/\bp\s*a?\s*o2\s*[:=]?\s*(\d{2,3}(?:[.,]\d+)?)\b/i],
      qualitative: [{ pattern: /ipossiem/i, line: "pO2 ridotta (ipossiemia)" }],
    },
    {
      id: "hco3",
      aliases: ["hco3", "hco3-", "bicarbonati", "bicarbonato"],
      label: "HCO3-",
      unit: "mEq/L",
      normal: "HCO3- 24 mEq/L",
      numeric: [/\bhco3-?\s*[:=]?\s*(\d{1,2}(?:[.,]\d+)?)\b/i],
      qualitative: [
        { pattern: /bicarbonat[oi].{0,24}ridott|hco3-?.{0,16}ridott/i, line: "HCO3- ridotti" },
        { pattern: /bicarbonat[oi].{0,24}aument|hco3-?.{0,16}aument/i, line: "HCO3- aumentati" },
      ],
    },
    {
      id: "lattati",
      aliases: ["lattati", "lattato", "acido lattico", "lactate"],
      label: "Lattati",
      unit: "mmol/L",
      normal: "Lattati 1.0 mmol/L",
      numeric: [/\blattat[oi]\s*[:=]?\s*(\d+(?:[.,]\d+)?)\b/i],
      qualitative: [
        { pattern: /iperlatt|lattat[oi].{0,24}(?:aument|elevat)/i, line: "Lattati aumentati" },
      ],
      componentExamIds: ["lattati"],
    },
    {
      id: "sao2",
      aliases: ["sao2", "sat", "saturazione"],
      label: "SaO2",
      unit: "%",
      normal: "SaO2 97%",
      numeric: [/\b(?:sao2|saturazione(?:\s+di\s+ossigeno)?)\s*[:=]?\s*(\d{2,3}(?:[.,]\d+)?)\s*%?/i],
      qualitative: [
        {
          pattern: /saturazione(?:\s+di\s+ossigeno)?.{0,24}ridott|desatur/i,
          line: "SaO2 ridotta",
        },
      ],
    },
  ],
};

const EMOCROMO_PANEL: StandardLabPanel = {
  ids: ["emocromo", "cbc", "emocromo-completo"],
  parameters: [
    {
      id: "hb",
      aliases: ["hb", "emoglobina", "hgb"],
      label: "Hb",
      unit: "g/dL",
      normal: "Hb 14.0 g/dL",
      numeric: [/\b(?:hb|emoglobina)\s*[:=]?\s*(\d{1,2}(?:[.,]\d+)?)\b/i],
      qualitative: [
        { pattern: /anem/i, line: "Hb ridotta (anemia)" },
        { pattern: /policitem|emoglobina.{0,20}aument/i, line: "Hb aumentata" },
      ],
    },
    {
      id: "hct",
      aliases: ["hct", "ematocrito"],
      label: "Hct",
      unit: "%",
      normal: "Hct 42%",
      numeric: [/\b(?:hct|ematocrito)\s*[:=]?\s*(\d{2}(?:[.,]\d+)?)\b/i],
      qualitative: [],
    },
    {
      id: "rbc",
      aliases: ["rbc", "eritrociti", "globuli rossi"],
      label: "RBC",
      unit: "×10^6/µL",
      normal: "RBC 4.80 ×10^6/µL",
      numeric: [/\b(?:rbc|eritrociti|globuli rossi)\s*[:=]?\s*(\d(?:[.,]\d+)?)\b/i],
      qualitative: [],
    },
    {
      id: "wbc",
      aliases: ["wbc", "leucociti", "globuli bianchi"],
      label: "WBC",
      unit: "×10^3/µL",
      normal: "WBC 7.0 ×10^3/µL",
      numeric: [/\b(?:wbc|leucociti|globuli bianchi)\s*[:=]?\s*(\d{1,3}(?:[.,]\d+)?)\b/i],
      qualitative: [
        { pattern: /leucocitos/i, line: "WBC aumentati (leucocitosi)" },
        { pattern: /leucopen/i, line: "WBC ridotti (leucopenia)" },
      ],
    },
    {
      id: "neutrofili",
      aliases: ["neutrofili", "neut"],
      label: "Neutrofili",
      unit: "%",
      normal: "Neutrofili 55%",
      numeric: [/\bneutrofili\s*[:=]?\s*(\d{1,2}(?:[.,]\d+)?)\b/i],
      qualitative: [{ pattern: /neutrofilia/i, line: "Neutrofili aumentati" }],
    },
    {
      id: "linfociti",
      aliases: ["linfociti", "linfociti %"],
      label: "Linfociti",
      unit: "%",
      normal: "Linfociti 32%",
      numeric: [/\blinfociti\s*[:=]?\s*(\d{1,2}(?:[.,]\d+)?)\b/i],
      qualitative: [{ pattern: /linfocitos/i, line: "Linfociti aumentati" }],
    },
    {
      id: "plt",
      aliases: ["plt", "piastrine"],
      label: "PLT",
      unit: "×10^3/µL",
      normal: "PLT 250 ×10^3/µL",
      numeric: [/\b(?:plt|piastrine)\s*[:=]?\s*(\d{2,4}(?:[.,]\d+)?)\b/i],
      qualitative: [
        { pattern: /piastrinopen|trombocitopen/i, line: "PLT ridotte" },
        { pattern: /piastrinos|trombocitos/i, line: "PLT aumentate" },
      ],
    },
  ],
};

const ELETTROLITI_PANEL: StandardLabPanel = {
  ids: ["elettroliti", "elettroliti-sierici", "electrolytes"],
  parameters: [
    {
      id: "na",
      aliases: ["na", "sodio", "natriemia"],
      label: "Na",
      unit: "mEq/L",
      normal: "Na 140 mEq/L",
      numeric: [/\b(?:sodio|natriemia|na\+?)\s*[:=]?\s*(\d{2,3}(?:[.,]\d+)?)\b/i],
      qualitative: [
        { pattern: /iponatrem/i, line: "Na ridotto (iponatriemia)" },
        { pattern: /ipernatrem/i, line: "Na aumentato (ipernatriemia)" },
      ],
    },
    {
      id: "k",
      aliases: ["k", "potassio", "kaliemia"],
      label: "K",
      unit: "mEq/L",
      normal: "K 4.0 mEq/L",
      numeric: [/\b(?:potassio|kaliemia|k\+?)\s*[:=]?\s*(\d(?:[.,]\d+)?)\b/i],
      qualitative: [
        { pattern: /ipokaliem/i, line: "K ridotto (ipokaliemia)" },
        { pattern: /iperkaliem/i, line: "K aumentato (iperkaliemia)" },
      ],
    },
    {
      id: "ca",
      aliases: ["ca", "calcio", "calcemia"],
      label: "Ca",
      unit: "mg/dL",
      normal: "Ca 9.2 mg/dL",
      numeric: [/\b(?:calcemia|calcio|ca\+?)\s*[:=]?\s*(\d{1,2}(?:[.,]\d+)?)\b/i],
      qualitative: [
        { pattern: /ipocalcem/i, line: "Ca ridotto (ipocalcemia)" },
        { pattern: /ipercalcem/i, line: "Ca aumentato (ipercalcemia)" },
      ],
    },
    {
      id: "mg",
      aliases: ["mg", "magnesio", "magnesiemia"],
      label: "Mg",
      unit: "mg/dL",
      normal: "Mg 2.0 mg/dL",
      numeric: [/\b(?:magnesiemia|magnesio|mg\+?)\s*[:=]?\s*(\d(?:[.,]\d+)?)\b/i],
      qualitative: [
        { pattern: /ipomagnes/i, line: "Mg ridotto" },
        { pattern: /ipermagnes/i, line: "Mg aumentato" },
      ],
    },
    {
      id: "cl",
      aliases: ["cl", "cloro", "cloremia"],
      label: "Cl",
      unit: "mEq/L",
      normal: "Cl 102 mEq/L",
      numeric: [/\b(?:cloremia|cloro|cl-?)\s*[:=]?\s*(\d{2,3}(?:[.,]\d+)?)\b/i],
      qualitative: [],
    },
    {
      id: "p",
      aliases: ["p", "fosforo", "fosfati"],
      label: "P",
      unit: "mg/dL",
      normal: "P 3.5 mg/dL",
      numeric: [/\b(?:fosforo|fosfati|p)\s*[:=]\s*(\d(?:[.,]\d+)?)\b/i],
      qualitative: [],
    },
  ],
};

const STANDARD_LAB_PANELS: StandardLabPanel[] = [EGA_PANEL, EMOCROMO_PANEL, ELETTROLITI_PANEL];

const PANEL_BY_ID = new Map<string, StandardLabPanel>();
for (const panel of STANDARD_LAB_PANELS) {
  for (const id of panel.ids) PANEL_BY_ID.set(normalizeKey(id), panel);
}

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Clausole osservative: esclude il titolo «nel contesto di» e i «da valutare». */
function observationText(raw: string | null | undefined): string {
  if (!raw?.trim()) return "";
  const kept = raw
    .split(/[.;]\s+/)
    .map((part) => part.trim())
    .filter((clause) => {
      if (!clause) return false;
      if (/nel contesto di/i.test(clause)) return false;
      if (/\(\s*(cardio|pneumo|gastro)-\d{3}\s*\)/i.test(clause)) return false;
      if (/non di prima intenzione|spreco ssn/i.test(clause)) return false;
      if (/\bda valutare\b/i.test(clause) && !/\d/.test(clause)) return false;
      if (/^\s*(eseguire|iniziare|programmare|si consiglia)/i.test(clause)) return false;
      return true;
    });
  return kept.join(". ");
}

function readStructured(value: LabPanelCaseValue | undefined, param: PanelParameter): string | null {
  if (!value) return null;
  const raw = value as LabPanelCaseValue & Record<string, unknown>;
  const keys = new Set([param.id, param.label, ...param.aliases].map(normalizeKey));
  for (const candidate of [raw.parameters, raw.panel, raw.values]) {
    if (!isRecord(candidate)) continue;
    for (const [key, entry] of Object.entries(candidate)) {
      if (!keys.has(normalizeKey(key)) || entry == null) continue;
      const text = String(entry).trim();
      if (text) return text;
    }
  }
  return null;
}

function readNumeric(text: string, param: PanelParameter): string | null {
  if (!text.trim()) return null;
  for (const pattern of param.numeric) {
    const match = pattern.exec(text);
    if (!match?.[1]) continue;
    const value = match[1].replace(",", ".");
    return param.unit ? `${param.label} ${value} ${param.unit}` : `${param.label} ${value}`;
  }
  return null;
}

function readQualitative(text: string, param: PanelParameter): string | null {
  if (!text.trim()) return null;
  for (const hint of param.qualitative) {
    if (hint.pattern.test(text)) return hint.line;
  }
  return null;
}

function formatOverride(param: PanelParameter, raw: string): string {
  const text = raw.trim();
  if (text.toLowerCase().startsWith(param.label.toLowerCase())) return text;
  if (param.unit && /^[\d.,<>\s]+$/.test(text)) {
    return `${param.label} ${text.replace(",", ".")} ${param.unit}`.replace(/\s+/g, " ").trim();
  }
  return `${param.label} ${text}`;
}

function resolveStandardLabPanel(examId: string): StandardLabPanel | null {
  return PANEL_BY_ID.get(normalizeKey(examId)) ?? null;
}

/**
 * Referto completo del pannello. `null` se l'esame non è un pannello standard.
 * I valori del caso (`advancedExams.values`) sovrascrivono solo il parametro citato.
 */
export function mergeStandardLabPanel(
  examId: string,
  caseValues: Record<string, LabPanelCaseValue | null | undefined>,
): string | null {
  const panel = resolveStandardLabPanel(examId);
  if (!panel) return null;

  const own = caseValues[examId] ?? undefined;
  const ownObservations = `${observationText(own?.finding)}\n${observationText(own?.normalFinding)}`;

  const lines = panel.parameters.map((param) => {
    const structured =
      readStructured(own, param) ??
      (param.componentExamIds ?? [])
        .map((id) => readStructured(caseValues[id] ?? undefined, param))
        .find((value): value is string => Boolean(value)) ??
      null;
    if (structured) return formatOverride(param, structured);

    const componentObservations = (param.componentExamIds ?? [])
      .map((id) => observationText(caseValues[id]?.finding))
      .join("\n");

    const numeric = readNumeric(`${ownObservations}\n${componentObservations}`, param);
    if (numeric) return numeric;

    const qualitative = readQualitative(`${ownObservations}\n${componentObservations}`, param);
    if (qualitative) return qualitative;

    return param.normal;
  });

  return lines.join("\n");
}
