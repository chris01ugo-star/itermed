/**
 * Maps case demographics (`sex` / `gender`) onto Italian grammatical gender.
 * Accepts canonical F/M and common Italian/English labels from authored cases.
 */

export type PatientGrammaticalGender = "M" | "F";

export function resolvePatientGrammaticalGender(
  raw: string | null | undefined,
): PatientGrammaticalGender | null {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;

  if (
    s === "f" ||
    s === "w" ||
    s === "female" ||
    s === "woman" ||
    s === "donna" ||
    s.startsWith("femmin")
  ) {
    return "F";
  }

  if (
    s === "m" ||
    s === "male" ||
    s === "man" ||
    s === "uomo" ||
    s.startsWith("masch")
  ) {
    return "M";
  }

  return null;
}

export function italianAgreementPhrase(gender: PatientGrammaticalGender): string {
  return gender === "F"
    ? "femminile (es. sono andata, sono stanca, sono preoccupata)"
    : "maschile (es. sono andato, sono stanco, sono preoccupato)";
}

export function patientSexLabel(gender: PatientGrammaticalGender | null): string {
  if (gender === "F") return "DONNA/FEMMINA";
  if (gender === "M") return "UOMO/MASCHIO";
  return "non specificato";
}

/** Common Italian given names. Used only when the case has no dedicated sex field. */
const FEMALE_GIVEN_NAMES = new Set([
  "anna",
  "elena",
  "maria",
  "rosa",
  "giulia",
  "sara",
  "chiara",
  "francesca",
  "lucia",
  "laura",
  "federica",
  "sofia",
  "martina",
  "alessia",
  "valentina",
  "silvia",
  "paola",
  "carla",
  "teresa",
  "giovanna",
  "angela",
  "rita",
  "beatrice",
  "irene",
  "alice",
  "emma",
  "giada",
  "elisa",
  "monica",
  "stefania",
  "daniela",
  "roberta",
  "simona",
  "patrizia",
  "cristina",
  "antonella",
  "claudia",
  "marta",
  "ilaria",
  "serena",
  "alessandra",
  "caterina",
  "cecilia",
  "bianca",
  "vittoria",
  "raffaella",
  "luisa",
  "giuseppina",
  "carmela",
  "adele",
  "noemi",
  "camilla",
  "veronica",
  "debora",
  "nadia",
  "piera",
  "ornella",
  "donatella",
  "margherita",
  "nicole",
]);

const MALE_GIVEN_NAMES = new Set([
  "luca",
  "luigi",
  "roberto",
  "giorgio",
  "franco",
  "mario",
  "marco",
  "paolo",
  "davide",
  "giovanni",
  "alessandro",
  "matteo",
  "andrea",
  "nicola",
  "francesco",
  "giuseppe",
  "antonio",
  "carlo",
  "stefano",
  "massimo",
  "enrico",
  "riccardo",
  "simone",
  "fabio",
  "claudio",
  "alberto",
  "daniele",
  "michele",
  "salvatore",
  "vincenzo",
  "pietro",
  "angelo",
  "bruno",
  "sergio",
  "vittorio",
  "umberto",
  "emanuele",
  "gabriele",
  "tommaso",
  "lorenzo",
  "federico",
  "giacomo",
  "filippo",
  "mattia",
  "elia",
  "battista",
  "enea",
  "alessio",
  "diego",
  "samuele",
  "edoardo",
  "leonardo",
  "raffaele",
  "mauro",
  "renato",
  "gianni",
  "piero",
]);

/** Masculine given names that end in -a and must not be read as feminine. */
const MALE_NAMES_ENDING_IN_A = new Set([
  "luca",
  "andrea",
  "nicola",
  "mattia",
  "elia",
  "battista",
  "enea",
]);

const NOT_A_GIVEN_NAME = new Set([
  "un",
  "una",
  "il",
  "la",
  "lo",
  "molto",
  "poco",
  "tanto",
  "qui",
  "stanco",
  "stanca",
  "preoccupato",
  "preoccupata",
  "spaventato",
  "spaventata",
  "nauseato",
  "nauseata",
  "diabetico",
  "diabetica",
  "iperteso",
  "ipertesa",
  "confuso",
  "confusa",
  "venuto",
  "venuta",
  "andato",
  "andata",
  "nato",
  "nata",
]);

function countMatches(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

/**
 * Lexical sex cues in title, description, or patient script.
 * "il paziente" alone is ignored: it is generic and would force the masculine.
 */
export function inferGrammaticalGenderFromCaseText(
  text: string | null | undefined,
): PatientGrammaticalGender | null {
  if (!text?.trim()) return null;
  const s = text.toLowerCase();

  const female =
    countMatches(s, /\bdonn[ae]\b/g) +
    countMatches(s, /\bfemmina\b/g) +
    countMatches(s, /\bfemminile\b/g) +
    countMatches(s, /\bsignora\b/g) +
    countMatches(s, /\bla paziente\b/g) +
    countMatches(s, /\bsesso\s+femminile\b/g) +
    countMatches(s, /\bpaziente\s+f\b/g);

  const male =
    countMatches(s, /\buomini\b|\buomo\b/g) +
    countMatches(s, /\bmaschio\b/g) +
    countMatches(s, /\bmaschile\b/g) +
    countMatches(s, /\bsignore\b/g) +
    countMatches(s, /\bsesso\s+maschile\b/g) +
    countMatches(s, /\bpaziente\s+m\b/g);

  if (female === male) return null;
  return female > male ? "F" : "M";
}

/** First-person Italian agreement already written into the patient script. */
export function inferGrammaticalGenderFromFirstPerson(
  text: string | null | undefined,
): PatientGrammaticalGender | null {
  if (!text?.trim()) return null;
  const s = text.toLowerCase();
  const female = countMatches(
    s,
    /\b(stanca|preoccupata|spaventata|nauseata|diabetica|ipertesa|confusa|venuta|andata|nata|debolissima|affaticata|cardiopatica|ansiosa|sudata)\b/g,
  );
  const male = countMatches(
    s,
    /\b(stanco|preoccupato|spaventato|nauseato|diabetico|iperteso|confuso|venuto|andato|nato|debolissimo|affaticato|cardiopatico|ansioso)\b/g,
  );
  if (female === male) return null;
  return female > male ? "F" : "M";
}

export function inferGrammaticalGenderFromGivenName(
  name: string | null | undefined,
): PatientGrammaticalGender | null {
  if (!name?.trim()) return null;
  const key = name.trim().toLowerCase();
  if (FEMALE_GIVEN_NAMES.has(key)) return "F";
  if (MALE_GIVEN_NAMES.has(key)) return "M";
  if (key.endsWith("a") && !MALE_NAMES_ENDING_IN_A.has(key)) return "F";
  if (key.endsWith("o")) return "M";
  return null;
}

function acceptGivenName(token: string | undefined): string | null {
  if (!token) return null;
  const cleaned = token.replace(/[,.:;]+$/g, "");
  if (!/^[A-ZÀ-Ý][a-zà-ÿ'-]{1,24}$/.test(cleaned)) return null;
  if (NOT_A_GIVEN_NAME.has(cleaned.toLowerCase())) return null;
  return cleaned;
}

/** First token of an anagraphic name field (`"Anna Bianchi"` → `"Anna"`). */
export function givenNameFromField(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  return acceptGivenName(raw.trim().split(/\s+/)[0]);
}

/**
 * Deterministic given name from the patient script or case narrative
 * (`"Sei Anna, 71 anni"` → `"Anna"`).
 */
export function extractPatientGivenName(
  ...texts: Array<string | null | undefined>
): string | null {
  const patterns = [
    /\bSei\s+([A-ZÀ-Ý][a-zà-ÿ'-]{1,24})\b/,
    /\bmi chiamo\s+([A-ZÀ-Ý][a-zà-ÿ'-]{1,24})\b/i,
    /\bPaziente:\s*([A-ZÀ-Ý][a-zà-ÿ'-]{1,24})\b/,
    /\bnome:\s*([A-ZÀ-Ý][a-zà-ÿ'-]{1,24})\b/i,
  ];

  for (const raw of texts) {
    if (!raw?.trim()) continue;
    for (const pattern of patterns) {
      const match = raw.match(pattern);
      const name = acceptGivenName(match?.[1]);
      if (name) return name;
    }
  }
  return null;
}

export type ResolvedPatientPersona = {
  name: string;
  gender: PatientGrammaticalGender | null;
  sexLabel: string;
};

/**
 * Dedicated sex/gender field wins. Otherwise sex is inferred, in order, from
 * case wording, the anagraphic given name, then first-person agreement in the script.
 */
export function resolvePatientPersona(input: {
  explicitSex?: string | null;
  explicitName?: string | null;
  texts?: Array<string | null | undefined>;
}): ResolvedPatientPersona {
  const texts = (input.texts ?? []).filter((text): text is string => Boolean(text?.trim()));
  const narrative = texts.join("\n");
  const name =
    givenNameFromField(input.explicitName) ?? extractPatientGivenName(...texts) ?? "";

  const explicit = resolvePatientGrammaticalGender(input.explicitSex);
  const gender =
    explicit ??
    inferGrammaticalGenderFromCaseText(narrative) ??
    inferGrammaticalGenderFromGivenName(name) ??
    inferGrammaticalGenderFromFirstPerson(narrative);

  return {
    name: name || "(non indicato)",
    gender,
    sexLabel: patientSexLabel(gender),
  };
}
