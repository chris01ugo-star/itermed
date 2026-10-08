import type { TherapyDrugSpec, TherapyMatrix } from "@/lib/data/cases/types";
import type { SessionPrescription } from "@/lib/simulator/prescription-trace";

/**
 * Quota della terapia sul pilastro clinico, solo se il caso ha una matrice terapeutica.
 * Clinica = matrice ESC/AHA × (1 − 0,20) + appropriatezza terapeutica × 0,20.
 */
export const THERAPY_SHARE_OF_CLINICAL = 0.2;

/** Over-treatment: farmaco elencato come non indicato. */
export const INAPPROPRIATE_MEDICATION_PENALTY = 25;

/** Controindicazione non letale. Non attiva il killer switch. */
export const CONTRAINDICATED_MEDICATION_PENALTY = 40;

/**
 * Farmaco indicato con posologia fuori da `validDosages`.
 * Il match conta metà copertura, non come omissione.
 */
export const WRONG_DOSAGE_SLOT_CREDIT = 0.5;

const SOURCE_REF = "Rif. Gold therapy / prontuario del caso";

export type TherapyMatch = {
  id: string;
  label: string;
  matchedPrescription?: string;
  /** Posologia scritta sul ricettario, se il farmaco è stato prescritto. */
  prescribedPosology?: string;
  /** Posologie accettate dal caso. Presenti quando il dosaggio è stato giudicato. */
  validDosages?: string[];
};

export type TherapyEvaluation = {
  applicable: boolean;
  /** 0 se la matrice manca; altrimenti THERAPY_SHARE_OF_CLINICAL. */
  weight: number;
  /** 0–100, prima del blend col punteggio esami/procedure. */
  score: number;
  /** Match con farmaco e posologia corretti (o posologia non giudicata). */
  indicatedMet: number;
  indicatedExpected: number;
  correct: TherapyMatch[];
  /** Farmaco giusto, dose assente da `validDosages`. Credito 0,5 sul match. */
  wrongDosage: TherapyMatch[];
  omitted: TherapyMatch[];
  inappropriate: TherapyMatch[];
  contraindicated: TherapyMatch[];
  /**
   * Copertura = (pieni + 0,5 × posologie errate) / indicati attesi × 100.
   * Senza indicati la copertura parte da 100.
   * Terapia = copertura − 25 × inappropriati − 40 × controindicati, clamp [0, 100].
   * Senza `validDosages` la posologia non riduce il match.
   */
  formula: string;
  summary: string;
};

type DrugTarget = TherapyDrugSpec;

type IndicatedSlot = {
  id: string;
  label: string;
  mode: "required" | "anyOf";
  options: DrugTarget[];
};

type ParsedTherapy = {
  indicated: IndicatedSlot[];
  inappropriate: DrugTarget[];
  contraindicated: DrugTarget[];
};

type PrescriptionLike = Pick<
  SessionPrescription,
  "id" | "commercialName" | "activeIngredient" | "dosageForm" | "category"
> & { posology?: string };

const STOPWORDS = new Set([
  "ev",
  "iv",
  "im",
  "mg",
  "die",
  "bid",
  "tid",
  "q8h",
  "entro",
  "min",
  "piu",
  "se",
  "senza",
  "alte",
  "dosi",
  "urgente",
  "infusione",
  "tentabile",
  "orale",
  "endovenosa",
  "immediata",
  "monitoraggio",
  "continuo",
  "pronte",
  "indicazione",
  "tassativa",
  "nota",
  "aifa",
  "per",
  "con",
  "del",
  "della",
]);

/** Stem che identificano un farmaco dentro gli slug legacy di goldTherapy. */
const KNOWN_STEMS = [
  "furosemide",
  "torasemide",
  "nitroglicerina",
  "isosorbide",
  "metoprololo",
  "esmololo",
  "diltiazem",
  "verapamil",
  "amiodarone",
  "digossina",
  "atropina",
  "adrenalina",
  "noradrenalina",
  "isoproterenolo",
  "insulina",
  "patiromer",
  "colchicina",
  "ibuprofene",
  "aspirina",
  "pantoprazolo",
  "omeprazolo",
  "lansoprazolo",
  "esomeprazolo",
  "apixaban",
  "rivaroxaban",
  "dabigatran",
  "edoxaban",
  "bisoprololo",
  "carvedilolo",
  "atenololo",
  "propranololo",
  "nebivololo",
  "sotalolo",
  "ramipril",
  "enalapril",
  "spironolattone",
  "amlodipina",
  "clopidogrel",
  "ticagrelor",
  "enoxaparina",
  "eparina",
  "amoxicillina",
  "ceftriaxone",
  "azitromicina",
  "ciprofloxacina",
  "morfina",
  "fentanyl",
  "ketorolac",
  "paracetamolo",
  "desametasone",
  "idrocortisone",
  "dopamina",
  "lidocaina",
  "adenosina",
  "flecainide",
  "propafenone",
  "warfarin",
  "acenocumarolo",
  "gluconato",
  "ketoprofene",
  "naprossene",
  "diclofenac",
  "nimesulide",
] as const;

const KNOWN_STEM_SET = new Set<string>(KNOWN_STEMS);

const CLASS_ALIASES: Record<string, string[]> = {
  "beta bloccanti": [
    "metoprololo",
    "bisoprololo",
    "atenololo",
    "carvedilolo",
    "propranololo",
    "esmololo",
    "nebivololo",
    "sotalolo",
  ],
  betabloccanti: [
    "metoprololo",
    "bisoprololo",
    "atenololo",
    "carvedilolo",
    "propranololo",
    "esmololo",
    "nebivololo",
    "sotalolo",
  ],
  doac: ["apixaban", "rivaroxaban", "dabigatran", "edoxaban"],
  fans: ["ibuprofene", "ketoprofene", "naprossene", "diclofenac", "nimesulide"],
  diuretici: ["furosemide", "torasemide"],
  nitrati: ["nitroglicerina", "isosorbide"],
  antibiotici: ["amoxicillina", "ceftriaxone", "azitromicina", "ciprofloxacina"],
  ipp: ["pantoprazolo", "omeprazolo", "lansoprazolo", "esomeprazolo"],
};

const ASA_ALIASES = ["asa", "aspirina", "acetilsalicilico", "cardioaspirin"];

const NON_DRUG =
  /monitoraggio|pacing|pmk|cardioversion|pericardiocentes|posizione|consenso|sforz|placche|utic|studio|disposizione|ossigeno|cpap|nimv|boussignac|peep|imaging|coronarograf|\becg\b|\btc\b|\btac\b/;

const STOP_ACTION = /^(sospensione|sospeso|evitare|evita|non|no)[_\s]/;

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function normalizeTherapyText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isShortToken(token: string): boolean {
  return token === "asa" || token === "doac" || token === "fans" || token === "ipp";
}

function meaningfulTokens(raw: string): string[] {
  const tokens = normalizeTherapyText(raw).split(" ").filter(Boolean);
  const kept: string[] = [];
  for (const token of tokens) {
    if (STOPWORDS.has(token)) continue;
    if (isShortToken(token) || KNOWN_STEM_SET.has(token) || token.length >= 6) {
      kept.push(token);
    }
  }
  return kept;
}

function classAliasesFor(text: string): string[] {
  const norm = normalizeTherapyText(text);
  const extra: string[] = [];
  for (const [key, aliases] of Object.entries(CLASS_ALIASES)) {
    if (norm === key || norm.includes(key)) extra.push(...aliases);
  }
  if (/(^|\s)asa(\s|$)/.test(norm) || norm.includes("acetilsalicilico") || norm.includes("aspirina")) {
    extra.push(...ASA_ALIASES);
  }
  if (norm.includes("protezione gastrica")) extra.push(...CLASS_ALIASES.ipp);
  return extra;
}

function looksLikeDrug(raw: string): boolean {
  const norm = normalizeTherapyText(raw);
  if (!norm) return false;
  if (classAliasesFor(norm).length > 0) return true;
  if (meaningfulTokens(norm).some((token) => KNOWN_STEM_SET.has(token) || isShortToken(token))) {
    return true;
  }
  if (NON_DRUG.test(norm)) return false;
  return false;
}

function specFromText(raw: string, idHint?: string): DrugTarget | null {
  const label = raw.trim();
  if (!label || !looksLikeDrug(label)) return null;
  const stems = [
    ...new Set([...meaningfulTokens(label).filter((t) => KNOWN_STEM_SET.has(t) || isShortToken(t)), ...classAliasesFor(label)]),
  ];
  if (stems.length === 0) return null;
  const id = idHint?.trim() || stems[0] || normalizeTherapyText(label).replace(/\s+/g, "_");
  return { id, label, aliases: stems };
}

function slotFromString(raw: string, index: number): IndicatedSlot | null {
  const text = raw.trim();
  if (!text || STOP_ACTION.test(text)) return null;
  const anyOf = /\s+o\s+|_o_/i.test(text);
  if (anyOf) {
    const parts = text.split(/\s+o\s+|_o_/i).map((part) => part.trim()).filter(Boolean);
    const options = parts
      .map((part, partIndex) => specFromText(part, `opt_${index}_${partIndex}`))
      .filter((spec): spec is DrugTarget => spec != null);
    if (options.length === 0) {
      const whole = specFromText(text, `ind_${index}`);
      if (!whole) return null;
      return { id: whole.id, label: whole.label, mode: "required", options: [whole] };
    }
    return {
      id: `any_${index}`,
      label: text,
      mode: "anyOf",
      options,
    };
  }
  const spec = specFromText(text, `ind_${index}`);
  if (!spec) return null;
  return { id: spec.id, label: spec.label, mode: "required", options: [spec] };
}

function contraindicatedFromStopAction(raw: string): DrugTarget | null {
  if (!STOP_ACTION.test(raw.trim())) return null;
  const rest = raw.trim().replace(STOP_ACTION, "");
  return specFromText(rest, undefined);
}

function asDrugSpec(value: unknown): DrugTarget | null {
  if (typeof value === "string") return specFromText(value);
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id.trim() : "";
  const label = typeof row.label === "string" && row.label.trim() ? row.label.trim() : id;
  const aliases = Array.isArray(row.aliases)
    ? row.aliases.filter((alias): alias is string => typeof alias === "string" && alias.trim().length > 0)
    : [];
  if (!id && !label) return null;
  const spec = specFromText(aliases.length > 0 ? `${label} ${aliases.join(" ")}` : label, id || undefined);
  const validDosages = readValidDosages(row);
  const priceEuro = readPriceEuro(row);
  const priced = priceEuro != null ? { priceEuro } : {};
  if (spec) {
    return {
      id: id || spec.id,
      label: label || spec.label,
      aliases: [...new Set([...spec.aliases, ...aliases.map((alias) => normalizeTherapyText(alias)).filter(Boolean)])],
      ...(validDosages ? { validDosages } : {}),
      ...priced,
    };
  }
  if (!id || !label) return null;
  return {
    id,
    label,
    aliases: aliases.length > 0 ? aliases : [id, label],
    ...(validDosages ? { validDosages } : {}),
    ...priced,
  };
}

function readPriceEuro(row: Record<string, unknown>): number | undefined {
  const n = typeof row.priceEuro === "number" ? row.priceEuro : Number(row.priceEuro);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

function readValidDosages(row: Record<string, unknown>): string[] | undefined {
  if (!Array.isArray(row.validDosages)) return undefined;
  const list = row.validDosages
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim());
  return list.length > 0 ? list : undefined;
}

function parseCanonical(matrix: TherapyMatrix): ParsedTherapy {
  const indicated: IndicatedSlot[] = [];
  matrix.indicated.forEach((slot, index) => {
    if ("anyOf" in slot) {
      const options = slot.anyOf.map(asDrugSpec).filter((spec): spec is DrugTarget => spec != null);
      if (options.length === 0) return;
      indicated.push({
        id: `any_${index}`,
        label: slot.label?.trim() || options.map((option) => option.label).join(" o "),
        mode: "anyOf",
        options,
      });
      return;
    }
    const spec = asDrugSpec(slot);
    if (!spec) return;
    indicated.push({ id: spec.id, label: spec.label, mode: "required", options: [spec] });
  });
  return {
    indicated,
    inappropriate: (matrix.inappropriate ?? []).map(asDrugSpec).filter((spec): spec is DrugTarget => spec != null),
    contraindicated: (matrix.contraindicated ?? []).map(asDrugSpec).filter((spec): spec is DrugTarget => spec != null),
  };
}

function pushLegacyList(
  target: DrugTarget[],
  value: unknown,
) {
  const rows = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  for (const row of rows) {
    if (typeof row !== "string") {
      const spec = asDrugSpec(row);
      if (spec) target.push(spec);
      continue;
    }
    const stopped = contraindicatedFromStopAction(row);
    if (stopped) {
      target.push(stopped);
      continue;
    }
    const spec = specFromText(row);
    if (spec) target.push(spec);
  }
}

function parseLegacyGoldTherapy(raw: Record<string, unknown>): ParsedTherapy {
  const indicated: IndicatedSlot[] = [];
  const inappropriate: DrugTarget[] = [];
  const contraindicated: DrugTarget[] = [];

  const indicatedKeys = ["immediate", "ifUnstable", "ifMoreStable", "anticoagulation"] as const;
  for (const key of indicatedKeys) {
    const value = raw[key];
    const rows = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
    rows.forEach((row) => {
      if (typeof row !== "string") return;
      const stopped = contraindicatedFromStopAction(row);
      if (stopped) {
        contraindicated.push(stopped);
        return;
      }
      const slot = slotFromString(row, indicated.length);
      if (slot) indicated.push(slot);
    });
  }

  if (Array.isArray(raw.rateControl)) {
    const options = raw.rateControl
      .filter((row): row is string => typeof row === "string")
      .map((row, index) => specFromText(row, `rate_${index}`))
      .filter((spec): spec is DrugTarget => spec != null);
    if (options.length > 0) {
      indicated.push({
        id: "rate_control",
        label: "Controllo della frequenza",
        mode: "anyOf",
        options,
      });
    }
  }

  pushLegacyList(contraindicated, raw.contraindicated);
  pushLegacyList(contraindicated, raw.contraindicatedAcute);
  pushLegacyList(inappropriate, raw.inappropriate);
  pushLegacyList(inappropriate, raw.notIndicated);

  return { indicated, inappropriate, contraindicated };
}

function isCanonicalMatrix(value: unknown): value is TherapyMatrix {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Array.isArray((value as TherapyMatrix).indicated);
}

export function resolveTherapyMatrix(baseline: unknown): ParsedTherapy | null {
  if (!baseline || typeof baseline !== "object" || Array.isArray(baseline)) return null;
  const record = baseline as Record<string, unknown>;
  const canonical = record.therapyMatrix;
  const legacy = record.goldTherapy;
  const parsed = isCanonicalMatrix(canonical)
    ? parseCanonical(canonical)
    : legacy && typeof legacy === "object" && !Array.isArray(legacy)
      ? parseLegacyGoldTherapy(legacy as Record<string, unknown>)
      : null;
  if (!parsed) return null;
  if (
    parsed.indicated.length === 0 &&
    parsed.inappropriate.length === 0 &&
    parsed.contraindicated.length === 0
  ) {
    return null;
  }
  return parsed;
}

function prescriptionHaystack(rx: PrescriptionLike): string {
  return normalizeTherapyText(
    `${rx.id} ${rx.commercialName} ${rx.activeIngredient} ${rx.dosageForm} ${rx.category}`,
  );
}

function prescriptionLabel(rx: PrescriptionLike): string {
  const name = rx.commercialName.trim();
  const ingredient = rx.activeIngredient.trim();
  return ingredient && ingredient.toLowerCase() !== name.toLowerCase()
    ? `${name} (${ingredient})`
    : name;
}

function needlesFor(target: DrugTarget): string[] {
  const bag = new Set<string>();
  for (const raw of [target.id, target.label, ...target.aliases]) {
    const norm = normalizeTherapyText(raw);
    if (!norm) continue;
    if (isShortToken(norm) || norm.length >= 4) bag.add(norm);
    for (const token of meaningfulTokens(norm)) {
      if (KNOWN_STEM_SET.has(token) || isShortToken(token)) bag.add(token);
    }
    for (const alias of classAliasesFor(norm)) bag.add(alias);
  }
  return [...bag];
}

function includesTerm(haystack: string, needle: string): boolean {
  if (needle.length >= 5) return haystack.includes(needle);
  return new RegExp(`(?:^|\\s)${needle}(?:\\s|$)`).test(haystack);
}

function prescriptionMatches(rx: PrescriptionLike, target: DrugTarget): boolean {
  const hay = prescriptionHaystack(rx);
  const needles = needlesFor(target);
  const antidote =
    needles.some((needle) => /fab|antidig|digibind|anticorpo/.test(needle)) &&
    needles.some((needle) => needle.includes("digoss"));
  if (antidote) return /fab|antidig|digibind|anticorpo/.test(hay);
  return needles.some((needle) => includesTerm(hay, needle));
}

export type MedicationEconomyRole = "indicated" | "inappropriate" | "contraindicated" | "neutral";

export type MedicationEconomyLine = {
  id: string;
  name: string;
  costEuro: number;
  role: MedicationEconomyRole;
};

type PricedPrescription = PrescriptionLike & { price?: number };

function safeMedicationEuro(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function medicationName(rx: PricedPrescription): string {
  const name = rx.commercialName.trim();
  const ingredient = rx.activeIngredient.trim();
  if (!ingredient || ingredient.toLowerCase() === name.toLowerCase()) return name || rx.id;
  return `${name} (${ingredient})`;
}

/**
 * Spesa farmaci per il bilancio SSN.
 * Ideale = costo dei farmaci `indicated` (prezzo del pack prescritto, altrimenti `priceEuro`).
 * Inappropriate e contraindicated entrano per intero nello spreco.
 */
export function summarizeMedicationEconomics(params: {
  baselineExamFindings?: unknown;
  prescriptions?: PricedPrescription[] | null;
}): {
  medicationSpendEuro: number;
  idealMedicationEuro: number;
  lines: MedicationEconomyLine[];
  omittedIndicated: MedicationEconomyLine[];
} {
  const prescriptions = Array.isArray(params.prescriptions) ? params.prescriptions : [];
  const medicationSpendEuro = prescriptions.reduce((sum, rx) => sum + safeMedicationEuro(rx.price), 0);
  const matrix = resolveTherapyMatrix(params.baselineExamFindings);
  if (!matrix) {
    return {
      medicationSpendEuro,
      idealMedicationEuro: 0,
      lines: prescriptions.map((rx) => ({
        id: rx.id,
        name: medicationName(rx),
        costEuro: safeMedicationEuro(rx.price),
        role: "neutral" as const,
      })),
      omittedIndicated: [],
    };
  }

  const roleOf = (rx: PricedPrescription): MedicationEconomyRole => {
    if (matrix.contraindicated.some((target) => prescriptionMatches(rx, target))) return "contraindicated";
    if (matrix.inappropriate.some((target) => prescriptionMatches(rx, target))) return "inappropriate";
    if (matrix.indicated.some((slot) => slot.options.some((option) => prescriptionMatches(rx, option)))) {
      return "indicated";
    }
    return "neutral";
  };

  const lines = prescriptions.map((rx) => ({
    id: rx.id,
    name: medicationName(rx),
    costEuro: safeMedicationEuro(rx.price),
    role: roleOf(rx),
  }));

  const used = new Set<string>();
  let idealMedicationEuro = 0;
  const omittedIndicated: MedicationEconomyLine[] = [];

  matrix.indicated.forEach((slot, index) => {
    const hit = prescriptions.find(
      (rx) =>
        roleOf(rx) === "indicated" &&
        !used.has(rx.id) &&
        slot.options.some((option) => prescriptionMatches(rx, option)),
    );
    if (hit) {
      used.add(hit.id);
      idealMedicationEuro += safeMedicationEuro(hit.price);
      return;
    }
    const authored = slot.options
      .map((option) => safeMedicationEuro(option.priceEuro))
      .filter((price) => price > 0);
    if (authored.length === 0) return;
    const costEuro = Math.min(...authored);
    idealMedicationEuro += costEuro;
    omittedIndicated.push({
      id: slot.id || `indicated_${index}`,
      name: slot.label,
      costEuro,
      role: "indicated",
    });
  });

  return { medicationSpendEuro, idealMedicationEuro, lines, omittedIndicated };
}

function firstMatch(
  prescriptions: PrescriptionLike[],
  targets: DrugTarget[],
): PrescriptionLike | null {
  for (const rx of prescriptions) {
    if (targets.some((target) => prescriptionMatches(rx, target))) return rx;
  }
  return null;
}

export function normalizePosology(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Senza elenco, qualunque posologia è accettata. Con elenco, serve uguaglianza normalizzata. */
export function posologyIsAccepted(
  prescribed: string | null | undefined,
  validDosages: readonly string[] | null | undefined,
): boolean {
  if (!validDosages || validDosages.length === 0) return true;
  const hay = normalizePosology(prescribed);
  if (!hay) return false;
  return validDosages.some((dose) => normalizePosology(dose) === hay);
}

function matchIndicatedSlot(
  prescriptions: PrescriptionLike[],
  slot: IndicatedSlot,
): { rx: PrescriptionLike; option: DrugTarget; dosageOk: boolean } | null {
  let partial: { rx: PrescriptionLike; option: DrugTarget; dosageOk: boolean } | null = null;
  for (const rx of prescriptions) {
    for (const option of slot.options) {
      if (!prescriptionMatches(rx, option)) continue;
      const dosageOk = posologyIsAccepted(rx.posology, option.validDosages);
      if (dosageOk) return { rx, option, dosageOk: true };
      if (!partial) partial = { rx, option, dosageOk: false };
    }
  }
  return partial;
}

function emptyEvaluation(): TherapyEvaluation {
  return {
    applicable: false,
    weight: 0,
    score: 0,
    indicatedMet: 0,
    indicatedExpected: 0,
    correct: [],
    wrongDosage: [],
    omitted: [],
    inappropriate: [],
    contraindicated: [],
    formula: "Nessuna matrice terapeutica: il pilastro clinico resta la sola matrice ESC/AHA.",
    summary: "Terapia non valutata: il caso non definisce farmaci indicati o controindicati.",
  };
}

/**
 * Appropriatezza terapeutica 0–100.
 * Copertura = (match pieni + 0,5 × posologie errate) / indicati attesi.
 * Poi −25 per ogni farmaco inappropriato e −40 per ogni controindicato non letale.
 */
export function evaluateTherapyAppropriateness(params: {
  baselineExamFindings?: unknown;
  prescriptions?: PrescriptionLike[] | null;
}): TherapyEvaluation {
  const matrix = resolveTherapyMatrix(params.baselineExamFindings);
  if (!matrix) return emptyEvaluation();

  const prescriptions = Array.isArray(params.prescriptions) ? params.prescriptions : [];
  const correct: TherapyMatch[] = [];
  const wrongDosage: TherapyMatch[] = [];
  const omitted: TherapyMatch[] = [];

  for (const slot of matrix.indicated) {
    const hit = matchIndicatedSlot(prescriptions, slot);
    if (!hit) {
      omitted.push({ id: slot.id, label: slot.label });
      continue;
    }
    const row: TherapyMatch = {
      id: slot.id,
      label: slot.label,
      matchedPrescription: prescriptionLabel(hit.rx),
      prescribedPosology: hit.rx.posology?.trim() || undefined,
      ...(hit.option.validDosages?.length ? { validDosages: hit.option.validDosages } : {}),
    };
    if (hit.dosageOk) correct.push(row);
    else wrongDosage.push(row);
  }

  const inappropriate: TherapyMatch[] = [];
  for (const target of matrix.inappropriate) {
    const hit = firstMatch(prescriptions, [target]);
    if (!hit) continue;
    inappropriate.push({
      id: target.id,
      label: target.label,
      matchedPrescription: prescriptionLabel(hit),
    });
  }

  const contraindicated: TherapyMatch[] = [];
  for (const target of matrix.contraindicated) {
    const hit = firstMatch(prescriptions, [target]);
    if (!hit) continue;
    contraindicated.push({
      id: target.id,
      label: target.label,
      matchedPrescription: prescriptionLabel(hit),
    });
  }

  const indicatedExpected = matrix.indicated.length;
  const indicatedMet = correct.length;
  const coverageCredit = indicatedMet + wrongDosage.length * WRONG_DOSAGE_SLOT_CREDIT;
  const coverage = indicatedExpected === 0 ? 100 : (coverageCredit / indicatedExpected) * 100;
  const penalty =
    inappropriate.length * INAPPROPRIATE_MEDICATION_PENALTY +
    contraindicated.length * CONTRAINDICATED_MEDICATION_PENALTY;
  const score = clampScore(coverage - penalty);

  const formula =
    `Terapia = copertura (pieni ${indicatedMet} + ${WRONG_DOSAGE_SLOT_CREDIT}×${wrongDosage.length} posologie errate` +
    ` su ${indicatedExpected || 0}) ${Math.round(coverage)}/100` +
    ` − ${INAPPROPRIATE_MEDICATION_PENALTY}×${inappropriate.length} inappropriati` +
    ` − ${CONTRAINDICATED_MEDICATION_PENALTY}×${contraindicated.length} controindicati = ${score}/100. ` +
    `Senza validDosages la posologia non è giudicata. ` +
    `Clinica = ESC/AHA × ${((1 - THERAPY_SHARE_OF_CLINICAL) * 100).toFixed(0)}% + terapia × ${(THERAPY_SHARE_OF_CLINICAL * 100).toFixed(0)}%.`;

  const summary =
    `Terapia ${score}/100 (peso ${(THERAPY_SHARE_OF_CLINICAL * 100).toFixed(0)}% della clinica): ` +
    `indicati ${indicatedMet}/${indicatedExpected}` +
    (wrongDosage.length > 0
      ? ` · posologia errata: ${wrongDosage.map((item) => item.matchedPrescription || item.label).join("; ")}`
      : "") +
    (omitted.length > 0 ? ` · omessi: ${omitted.map((item) => item.label).slice(0, 4).join("; ")}` : "") +
    (inappropriate.length > 0
      ? ` · non indicati: ${inappropriate.map((item) => item.matchedPrescription).join("; ")}`
      : "") +
    (contraindicated.length > 0
      ? ` · controindicati: ${contraindicated.map((item) => item.matchedPrescription).join("; ")}`
      : "");

  return {
    applicable: true,
    weight: THERAPY_SHARE_OF_CLINICAL,
    score,
    indicatedMet,
    indicatedExpected,
    correct,
    wrongDosage,
    omitted,
    inappropriate,
    contraindicated,
    formula,
    summary,
  };
}

/** Blend sul punteggio clinico. Il danno iatrogeno non viene rialzato dalla terapia. */
export function blendClinicalScoreWithTherapy(
  examScore: number,
  therapyScore: number,
  options?: { iatrogenicCritical?: boolean; applicable?: boolean },
): number {
  if (options?.applicable === false || options?.iatrogenicCritical) {
    return clampScore(examScore);
  }
  const examWeight = 1 - THERAPY_SHARE_OF_CLINICAL;
  return clampScore(examScore * examWeight + therapyScore * THERAPY_SHARE_OF_CLINICAL);
}

export function applyTherapyToClinicalScore(params: {
  examScore: number;
  iatrogenicCritical?: boolean;
  baselineExamFindings?: unknown;
  prescriptions?: PrescriptionLike[] | null;
}): {
  score: number;
  therapy: TherapyEvaluation | null;
  motivation: {
    id: string;
    type: "positive" | "negative" | "neutral";
    text: string;
    sourceRef: string;
    scoreImpact: number;
  } | null;
} {
  const therapy = evaluateTherapyAppropriateness({
    baselineExamFindings: params.baselineExamFindings,
    prescriptions: params.prescriptions,
  });
  if (!therapy.applicable) {
    return { score: clampScore(params.examScore), therapy: null, motivation: null };
  }
  const score = blendClinicalScoreWithTherapy(params.examScore, therapy.score, {
    applicable: true,
    iatrogenicCritical: params.iatrogenicCritical,
  });
  const published: TherapyEvaluation = params.iatrogenicCritical
    ? {
        ...therapy,
        summary: `${therapy.summary} Il danno iatrogeno azzera comunque il pilastro clinico.`,
      }
    : therapy;
  return {
    score,
    therapy: published,
    motivation: therapyMotivation({
      examScore: params.examScore,
      blendedScore: score,
      therapy: published,
    }),
  };
}

export function therapyMotivation(params: {
  examScore: number;
  blendedScore: number;
  therapy: TherapyEvaluation;
}): {
  id: string;
  type: "positive" | "negative" | "neutral";
  text: string;
  sourceRef: string;
  scoreImpact: number;
} | null {
  if (!params.therapy.applicable) return null;
  return {
    id: "clin_therapy",
    type: params.therapy.score >= 70 ? "positive" : "negative",
    text: params.therapy.summary,
    sourceRef: SOURCE_REF,
    scoreImpact: params.blendedScore - clampScore(params.examScore),
  };
}
