import type { SessionPrescription } from "@/lib/simulator/prescription-trace";

/**
 * Classi allergiche → principi attivi del prontuario (`Medication.activeIngredient`).
 * `Medication.category` è la specialità (Cardiologia, Urgenza, …), non la classe farmacologica:
 * il collegamento resta qui, senza una colonna nuova sul database.
 */
export const ALLERGY_CLASS_MAPPINGS = {
  fans: [
    "ibuprofene",
    "ketorolac",
    "diclofenac",
    "ketoprofene",
    "naprossene",
    "nimesulide",
    "piroxicam",
    "indometacina",
    "acido acetilsalicilico",
    "aspirina",
    "cardioaspirin",
    "asa",
  ],
  nsaid: [
    "ibuprofene",
    "ketorolac",
    "diclofenac",
    "ketoprofene",
    "naprossene",
    "nimesulide",
    "acido acetilsalicilico",
    "aspirina",
  ],
  asa: ["acido acetilsalicilico", "aspirina", "cardioaspirin", "asa"],
  aspirina: ["acido acetilsalicilico", "aspirina", "cardioaspirin", "asa"],
  penicilline: ["amoxicillina", "ampicillina", "piperacillina", "benzilpenicillina", "penicillina"],
  penicillina: ["amoxicillina", "ampicillina", "piperacillina", "benzilpenicillina", "penicillina"],
  cefalosporine: ["ceftriaxone", "cefalexina", "cefuroxima", "ceftazidima", "cefepime", "cefazolina"],
  cefalosporina: ["ceftriaxone", "cefalexina", "cefuroxima", "ceftazidima", "cefepime", "cefazolina"],
  macrolidi: ["azitromicina", "claritromicina", "eritromicina"],
  chinolonici: ["levofloxacina", "ciprofloxacina", "moxifloxacina"],
  chinoloni: ["levofloxacina", "ciprofloxacina", "moxifloxacina"],
  sulfamidici: ["sulfametoxazolo", "cotrimossazolo"],
  oppioidi: ["morfina", "fentanil", "tramadolo", "codeina"],
  "ace inibitori": ["enalapril", "ramipril", "lisinopril", "perindopril"],
} as const satisfies Record<string, readonly string[]>;

export type AllergyFatalHit = {
  drugId: string;
  drugLabel: string;
  allergy: string;
  description: string;
  rationale: string;
};

type PrescriptionLike = Pick<SessionPrescription, "id" | "commercialName" | "activeIngredient">;

const SHORT_TRIGGERS = new Set(["asa"]);

function normalizeAllergyText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "Nessuna allergia nota" e simili non sono un'allergia dichiarata. */
export function isDeclaredAllergy(value: string): boolean {
  const norm = normalizeAllergyText(value);
  if (!norm) return false;
  if (/^(nessuna|nessuno|nessun|nkda|nka|assente|assenti|negativa|negativo|non note|non nota)$/.test(norm)) {
    return false;
  }
  if (/^nessun/.test(norm) || norm.startsWith("no known")) return false;
  return true;
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

/**
 * Allergie strutturate del caso. Non legge il testo libero di `pastMedicalHistory`
 * (lì "nessuna allergia a FANS" sarebbe un falso positivo).
 */
export function extractPatientAllergies(baseline: unknown): string[] {
  if (!baseline || typeof baseline !== "object" || Array.isArray(baseline)) return [];
  const record = baseline as Record<string, unknown>;
  const patient =
    record.patient && typeof record.patient === "object" && !Array.isArray(record.patient)
      ? (record.patient as Record<string, unknown>)
      : null;
  const demographics =
    record.demographics && typeof record.demographics === "object" && !Array.isArray(record.demographics)
      ? (record.demographics as Record<string, unknown>)
      : null;
  const lists = [
    readStringList(record.allergies),
    readStringList(patient?.allergies),
    readStringList(demographics?.allergies),
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const item of list) {
      if (!isDeclaredAllergy(item)) continue;
      const key = normalizeAllergyText(item);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item.trim());
    }
  }
  return out;
}

function triggersForAllergy(allergy: string): string[] {
  const norm = normalizeAllergyText(allergy);
  if (!isDeclaredAllergy(allergy)) return [];
  const triggers = new Set<string>();
  if (norm.length >= 4 || SHORT_TRIGGERS.has(norm)) triggers.add(norm);
  const tokens = norm.split(" ").filter(Boolean);
  for (const token of tokens) {
    if (token.length >= 5 || SHORT_TRIGGERS.has(token)) triggers.add(token);
    const mapped = ALLERGY_CLASS_MAPPINGS[token as keyof typeof ALLERGY_CLASS_MAPPINGS];
    if (mapped) for (const stem of mapped) triggers.add(stem);
  }
  for (const [key, stems] of Object.entries(ALLERGY_CLASS_MAPPINGS)) {
    if (norm === key || norm.includes(key)) {
      for (const stem of stems) triggers.add(stem);
    }
  }
  return [...triggers];
}

function includesTrigger(haystack: string, trigger: string): boolean {
  if (trigger.length <= 3) {
    return new RegExp(`(?:^|\\s)${trigger}(?:\\s|$)`).test(haystack);
  }
  return haystack.includes(trigger);
}

function prescriptionHaystack(rx: PrescriptionLike): string {
  return normalizeAllergyText(`${rx.id} ${rx.commercialName} ${rx.activeIngredient}`);
}

function drugLabel(rx: PrescriptionLike): string {
  const name = rx.commercialName.trim();
  const ingredient = rx.activeIngredient.trim();
  if (!ingredient || ingredient.toLowerCase() === name.toLowerCase()) return name || ingredient || rx.id;
  return `${name} (${ingredient})`;
}

export function allergyFatalDescription(drugLabel: string, allergy: string): string {
  return `Reazione allergica iatrogena grave: somministrato ${drugLabel} a paziente con allergia nota a ${allergy}`;
}

/**
 * Confronto trasversale ricettario × allergie del paziente.
 * Un hit è fatale: killer switch e clinica a zero.
 */
export function detectAllergyFatalPrescriptions(params: {
  baselineExamFindings?: unknown;
  allergies?: readonly string[] | null;
  prescriptions?: readonly PrescriptionLike[] | null;
}): AllergyFatalHit[] {
  const fromBaseline = extractPatientAllergies(params.baselineExamFindings);
  const extra = (params.allergies ?? []).map((item) => item.trim()).filter(isDeclaredAllergy);
  const allergies = [...fromBaseline];
  for (const item of extra) {
    if (!allergies.some((known) => normalizeAllergyText(known) === normalizeAllergyText(item))) {
      allergies.push(item);
    }
  }
  const prescriptions = Array.isArray(params.prescriptions) ? params.prescriptions : [];
  if (allergies.length === 0 || prescriptions.length === 0) return [];

  const hits: AllergyFatalHit[] = [];
  for (const rx of prescriptions) {
    const hay = prescriptionHaystack(rx);
    if (!hay) continue;
    for (const allergy of allergies) {
      const triggers = triggersForAllergy(allergy);
      if (!triggers.some((trigger) => includesTrigger(hay, trigger))) continue;
      const label = drugLabel(rx);
      hits.push({
        drugId: rx.id,
        drugLabel: label,
        allergy,
        description: allergyFatalDescription(label, allergy),
        rationale:
          "Il principio attivo o la classe del farmaco prescritto coincide con un'allergia dichiarata nel profilo del paziente. La somministrazione è un danno iatrogeno grave.",
      });
      break;
    }
  }
  return hits;
}
