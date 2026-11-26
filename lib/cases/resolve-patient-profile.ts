import { extractPatientAllergies } from "@/lib/services/evaluation-allergies";
import { patientDisplayName } from "@/lib/prassi/demo-vitals";
import {
  inferGrammaticalGenderFromFirstPerson,
  inferGrammaticalGenderFromGivenName,
} from "@/lib/simulator/patient-grammatical-gender";

/**
 * Single anagraphic and triage profile for the play UI and the patient prompt.
 *
 * Sex when demographics disagree with the prose:
 * demographics win, unless the title AND the first-person script both state the
 * opposite sex. That pair overrides demographics and is recorded in `coherenceNotes`.
 * A lone mismatch (title "Donna" with script "Giovanni" and demographics M) keeps
 * demographics and is only noted.
 * Age never falls back to 58. Missing age stays null.
 */

export type PatientSex = "M" | "F";

export type ResolvedPatientProfile = {
  name: string;
  age: number | null;
  sex: PatientSex | null;
  displayTitle: string;
  triageAnamnesis: string;
  clinicalHistory: string;
  allergies: string[];
  allergiesSummary: string;
  setting: string;
  coherenceNotes: string[];
};

export type PatientClueInput = {
  prompt?: string | null;
  rationale?: string | null;
};

export type SanitizedPatientClue = {
  ask: string;
  reveal: string;
};

export type ResolvePatientProfileInput = {
  id?: string | null;
  title?: string | null;
  description?: string | null;
  patientPrompt?: string | null;
  pastMedicalHistory?: string | null;
  presentation?: string | null;
  setting?: string | null;
  baselineExamFindings?: unknown;
  /** Used only to strip spoiler phrases. Never copied onto the result. */
  correctSolution?: string | null;
  diagnosis?: string | null;
  condition?: string | null;
};

const SPOILER_RE =
  /\b(GOLD|ELN|ESC\b|AHA|NICE|SNLG|BCR|ABL\d*|MRD|nomenclatore|spreco\s+SSN|tariff\w*|linee?\s+guida|philadelphia|leucemia|linfoblastica|blasti|STEMI|NSTEMI|fibrillazione\s+atriale|come\s+scrive|midostaurin|FLT3|IDH1|IDH2|NPM1)\b/i;

const EXAMINER_CLUE_RE =
  /\b(definisce\s+urgenza|finestra\s+terapeutica|obbligatori[oa]|come\s+scrive|GOLD|ELN|ESC|nomenclatore|tariff\w*|linea\s+guida|BCR|ABL|MRD|fusione|pannello|commissione|art\.?\s*\d|euro\b|spreco|prima\s+del|si\s+pu[oò]\s+dare)\b/i;

/** Rubrica per l'esaminatore: non è un fatto che il paziente possa raccontare. */
const EXAMINER_PROMPT_RE =
  /^(tempo e modalità|caratteristiche dei sintomi|fattori di rischio|terapie in atto|sintomi di allarme|contesto di presentazione)\b/i;

const EXAMINER_NOTE_RE =
  /profilo di rischio|contesto epidemiologico|baseline prescrittiva|fenotipo clinico|gelli-bianco|appropriatezza|red flag tempo|obblighi di trasferimento|la circolare dice/i;

/** Dati che la cartella non deve mai buttare via, anche dentro una frase di «nessuna patologia». */
const CLINICAL_KEEP_RE =
  /\b(familiarit[aà]|familiare|padre|madre|pap[àa]|mamma|fratell\w*|sorell\w*|nonn[oa]|zi[oa]|figli[oa]|genitori|ereditari\w*|allerg|fum\w*|sigarett\w*|alcol\w*|vino|farmac\w*|pillol\w*|assume|prende|terapia)\b/i;

const ABSENT_HISTORY_RE =
  /nessuna storia|nessuna patologia|non ha mai avuto|niente di rilevante|anamnesi muta/i;

const SETTING_LABEL: Record<string, string> = {
  GUARDIA_MEDICA: "Guardia Medica",
  PRONTO_SOCCORSO: "Pronto Soccorso",
  AMBULATORIO: "Ambulatorio",
  REPARTO: "Reparto",
};

const NAME_STOP = new Set([
  "venuto",
  "venuta",
  "molto",
  "molta",
  "qui",
  "stato",
  "stata",
  "stanco",
  "stanca",
  "andato",
  "andata",
  "preoccupato",
  "preoccupata",
  "solo",
  "sola",
  "io",
  "lui",
  "lei",
  "un",
  "una",
  "il",
  "la",
  "in",
  "già",
  "gia",
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function tidy(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function sentences(text: string): string[] {
  return text
    .split(/\n+|(?<=[.!?])\s+/)
    .map((part) => tidy(part))
    .filter((part) => part.length > 0);
}

function parseSexToken(value: unknown): PatientSex | null {
  if (typeof value !== "string") return null;
  const s = value.trim().toUpperCase();
  if (s === "M" || s === "MALE" || s === "MASCHIO" || s === "UOMO") return "M";
  if (s === "F" || s === "FEMALE" || s === "FEMMINA" || s === "DONNA") return "F";
  return null;
}

function sexFromProse(text: string): PatientSex | null {
  const lower = text.toLowerCase();
  if (/\b(donna|femmina|signora)\b/.test(lower)) return "F";
  if (/\b(uomo|maschio|signore)\b/.test(lower)) return "M";
  return null;
}

function ageFromProse(text: string): number | null {
  const match = text.match(/\b(\d{1,3})\s*anni\b/i);
  if (!match) return null;
  const n = Number(match[1]);
  return n >= 1 && n <= 110 ? n : null;
}

function explicitName(baseline: Record<string, unknown> | null): string | null {
  const demo = asRecord(baseline?.demographics);
  const patient = asRecord(baseline?.patient);
  const candidates = [demo?.name, demo?.fullName, demo?.firstName, demo?.givenName, patient?.name, patient?.firstName];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 1) return tidy(candidate);
  }
  return null;
}

function acceptName(token: string | undefined): string | null {
  if (!token) return null;
  const cleaned = token.replace(/[,.:;]+$/g, "");
  if (!/^[A-ZÀ-Ý][a-zà-ÿ'-]{1,24}$/.test(cleaned)) return null;
  if (NAME_STOP.has(cleaned.toLowerCase())) return null;
  return cleaned;
}

export function extractScriptGivenName(script: string | null | undefined): string | null {
  const text = script?.trim() ?? "";
  if (!text) return null;
  const patterns = [
    /\bmi chiamo\s+([A-ZÀ-Ý][a-zà-ÿ'-]{1,24})/i,
    /\bsono\s+la\s+signora\s+([A-ZÀ-Ý][a-zà-ÿ'-]{1,24})/i,
    /\bsono\s+il\s+signor[e]?\s+([A-ZÀ-Ý][a-zà-ÿ'-]{1,24})/i,
    /\bsono\s+([A-ZÀ-Ý][a-zà-ÿ'-]{1,24})\b/i,
    /\bsei\s+([A-ZÀ-Ý][a-zà-ÿ'-]{1,24})\b/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const name = acceptName(match?.[1]);
    if (name) return name;
  }
  return null;
}

function normalizeSetting(raw: string | null | undefined, corpus: string): string {
  const key = raw?.trim().toUpperCase().replace(/\s+/g, "_") ?? "";
  if (SETTING_LABEL[key]) return SETTING_LABEL[key];
  const lower = corpus.toLowerCase();
  if (/guardia medica/.test(lower)) return "Guardia Medica";
  if (/pronto soccorso/.test(lower)) return "Pronto Soccorso";
  if (/ambulatorio/.test(lower)) return "Ambulatorio";
  if (/reparto/.test(lower)) return "Reparto";
  return "Setting non indicato";
}

function spoilerPhrases(input: ResolvePatientProfileInput): string[] {
  return [input.correctSolution, input.diagnosis, input.condition]
    .map((value) => value?.trim() ?? "")
    .filter((value) => value.length >= 12 && value.length <= 180);
}

function isSpoilerSentence(sentence: string, phrases: string[]): boolean {
  if (SPOILER_RE.test(sentence)) return true;
  const lower = sentence.toLowerCase();
  return phrases.some((phrase) => lower.includes(phrase.toLowerCase()));
}

function cleanSentences(text: string, phrases: string[]): string[] {
  return sentences(text).filter((sentence) => !isSpoilerSentence(sentence, phrases));
}

function clip(text: string, max = 280): string {
  const tidyText = tidy(text);
  if (tidyText.length <= max) return tidyText;
  return `${tidyText.slice(0, max - 1).trim()}…`;
}

function chiefSymptom(chunks: string[], phrases: string[]): string {
  for (const chunk of chunks) {
    const kept = cleanSentences(chunk, phrases);
    for (const sentence of kept) {
      const withoutIntro = sentence
        .replace(/\bmi chiamo\s+[A-ZÀ-Ý][a-zà-ÿ'-]+(?:\s+e)?/i, "")
        .replace(/\b(?:ho|ha)\s+\d{1,3}\s*anni\b/i, "")
        .replace(/\b(?:sono|sei)\s+[A-ZÀ-Ý][a-zà-ÿ'-]+\b/i, "")
        .replace(/^[\s,.;]+/, "");
      const symptom = tidy(withoutIntro);
      if (symptom.length >= 12 && !sexFromProse(symptom)) {
        return clip(symptom.replace(/^[a-zà-ÿ]/, (char) => char.toLowerCase()), 90);
      }
    }
  }
  return "sintomi da inquadrare";
}

function titleGenderAgrees(title: string, sex: PatientSex | null): boolean {
  const titleSex = sexFromProse(title);
  if (!titleSex || !sex) return true;
  return titleSex === sex;
}

function titleIsPlayerSafe(title: string, sex: PatientSex | null, phrases: string[]): boolean {
  const trimmed = title.trim();
  if (!trimmed) return false;
  if (!titleGenderAgrees(trimmed, sex)) return false;
  return !isSpoilerSentence(trimmed, phrases);
}

/**
 * Se la stessa frase nega patologie e poi racconta un dato reale (familiarità,
 * allergia, fumo, alcol, farmaci), tiene il dato reale.
 */
function preserveRealClinicalDatum(sentence: string): string {
  if (!ABSENT_HISTORY_RE.test(sentence) || !CLINICAL_KEEP_RE.test(sentence)) return sentence;
  const parts = sentence
    .split(/[,;]/)
    .map((part) => tidy(part))
    .filter((part) => part.length >= 8);
  const real = parts.filter((part) => CLINICAL_KEEP_RE.test(part) && !ABSENT_HISTORY_RE.test(part));
  if (real.length === 0) return sentence;
  const absent = parts.filter((part) => ABSENT_HISTORY_RE.test(part) && !CLINICAL_KEEP_RE.test(part));
  return tidy([...absent, ...real].join(". "));
}

function chronicHistory(history: string, phrases: string[]): string {
  const isAgeIntro = (sentence: string) =>
    /^(uomo|donna|paziente)\b/i.test(sentence) &&
    sentence.length < 48 &&
    !CLINICAL_KEEP_RE.test(sentence);
  const kept = cleanSentences(history, phrases)
    .map(preserveRealClinicalDatum)
    .filter((sentence) => sentence.length >= 8 && !isAgeIntro(sentence));
  if (kept.length === 0) return "Nessuna patologia cronica nota.";
  return clip(kept.join(" "), 1200);
}

function parseHistoryAllergies(history: string): { declared: string[]; denied: boolean } {
  const declared: string[] = [];
  let denied = false;
  for (const sentence of sentences(history)) {
    if (/\b(nessuna allerg|non ha allerg|nega(?:\s+\w+){0,2}\s+allerg|senza allergie note|non è allergic|non e' allergic)\b/i.test(sentence)) {
      denied = true;
      continue;
    }
    const match = sentence.match(/\ballerg(?:ic[oa]|ia)\s+a(?:l|i|lle|l')?\s+([^.;]+)/i);
    const label = match?.[1]?.trim();
    if (label && !/^nulla|niente|farmaci$/i.test(label)) declared.push(tidy(label));
  }
  return { declared, denied };
}

export function patientSafeProse(text: string | null | undefined): string {
  const kept = sentences(text ?? "").filter(
    (sentence) => !SPOILER_RE.test(sentence) && !EXAMINER_CLUE_RE.test(sentence),
  );
  return tidy(kept.join(" "));
}

/**
 * Come `patientSafeProse`, ma se la frase contiene familiarità, allergie, fumo,
 * alcol o farmaci toglie solo il token da esaminatore e tiene il dato clinico.
 */
export function patientSafeAnamnesisFact(text: string | null | undefined): string {
  const kept = sentences(text ?? "").flatMap((sentence) => {
    if (!SPOILER_RE.test(sentence) && !EXAMINER_CLUE_RE.test(sentence)) return [sentence];
    if (!CLINICAL_KEEP_RE.test(sentence)) return [];
    const redacted = tidy(sentence.replace(SPOILER_RE, " ").replace(EXAMINER_CLUE_RE, " "));
    return redacted.length >= 8 ? [redacted] : [];
  });
  return tidy(kept.join(" "));
}

function isPatientFacingFact(text: string): boolean {
  if (text.length < 8) return false;
  if (text.includes("?")) return false;
  if (EXAMINER_PROMPT_RE.test(text)) return false;
  if (EXAMINER_NOTE_RE.test(text)) return false;
  if (EXAMINER_CLUE_RE.test(text) || SPOILER_RE.test(text)) return false;
  return true;
}

export function sanitizeCluesForPatient(clues: PatientClueInput[] | null | undefined): SanitizedPatientClue[] {
  const out: SanitizedPatientClue[] = [];
  for (const clue of clues ?? []) {
    // `rationale` è una nota per l'esaminatore: non diventa mai la risposta del paziente.
    const fact = tidy(clue.prompt ?? "");
    if (!isPatientFacingFact(fact)) continue;
    out.push({ ask: fact, reveal: fact });
  }
  return out;
}

export function resolvePatientProfile(input: ResolvePatientProfileInput): ResolvedPatientProfile {
  const baseline = asRecord(input.baselineExamFindings);
  const demo = asRecord(baseline?.demographics);
  const notes: string[] = [];
  const phrases = spoilerPhrases(input);

  const script = input.patientPrompt?.trim() ?? "";
  const scriptName = extractScriptGivenName(script);
  const titleSex = sexFromProse(input.title ?? "");
  const scriptNameSex = inferGrammaticalGenderFromGivenName(scriptName);
  const scriptVoiceSex = inferGrammaticalGenderFromFirstPerson(script);
  const scriptSex = scriptNameSex ?? scriptVoiceSex;
  const historySex = sexFromProse(input.pastMedicalHistory ?? "");
  const narrativeSex =
    historySex ??
    sexFromProse(input.presentation ?? "") ??
    sexFromProse(input.description ?? "") ??
    scriptSex ??
    titleSex;

  const demoSex = parseSexToken(demo?.sex) ?? parseSexToken(demo?.gender);
  let sex: PatientSex | null = demoSex;
  if (demoSex && titleSex && scriptSex && titleSex === scriptSex && titleSex !== demoSex) {
    sex = titleSex;
    notes.push(
      `demographics.sex ${demoSex} overridden: title and script both state ${titleSex}.`,
    );
  } else if (demoSex) {
    sex = demoSex;
    if (titleSex && titleSex !== demoSex) {
      notes.push(`title sex ${titleSex} disagrees with demographics.sex ${demoSex}; demographics kept.`);
    }
    if (scriptSex && scriptSex !== demoSex) {
      notes.push(`script sex ${scriptSex} disagrees with demographics.sex ${demoSex}; demographics kept.`);
    }
  } else {
    sex = narrativeSex;
    if (!sex) notes.push("sex missing in demographics and narrative.");
  }

  const demoAgeRaw = demo?.age;
  const demoAge =
    typeof demoAgeRaw === "number" && demoAgeRaw >= 1 && demoAgeRaw <= 110
      ? Math.round(demoAgeRaw)
      : typeof demoAgeRaw === "string" && /^\d{1,3}$/.test(demoAgeRaw.trim())
        ? Number(demoAgeRaw.trim())
        : null;
  const narrativeAge =
    ageFromProse(input.pastMedicalHistory ?? "") ??
    ageFromProse(script) ??
    ageFromProse(input.presentation ?? "") ??
    ageFromProse(input.description ?? "") ??
    ageFromProse(input.title ?? "");
  let age: number | null = demoAge ?? narrativeAge;
  if (demoAge != null && narrativeAge != null && Math.abs(demoAge - narrativeAge) >= 2) {
    notes.push(`narrative age ${narrativeAge} disagrees with demographics.age ${demoAge}; demographics kept.`);
    age = demoAge;
  }
  if (age == null) notes.push("age missing in demographics and narrative.");

  const explicit = explicitName(baseline);
  const name =
    explicit ??
    scriptName ??
    patientDisplayName(input.id?.trim() || "caso", input.title, sex);

  const symptom = chiefSymptom(
    [input.presentation ?? "", input.description ?? "", script],
    phrases,
  );
  const authoredTitle = input.title?.trim() ?? "";
  const displayTitle = titleIsPlayerSafe(authoredTitle, sex, phrases)
    ? authoredTitle
    : `Paziente${age != null ? ` di ${age} anni` : ""} con ${symptom}`;

  const triageSource = [input.presentation, input.description, script].find((chunk) => {
    const kept = cleanSentences(chunk ?? "", phrases);
    return kept.length > 0;
  });
  const triageAnamnesis = clip(
    cleanSentences(triageSource ?? "", phrases).join(" ") ||
      "Motivo di accesso da raccogliere con il paziente.",
    420,
  );

  const clinicalHistory = chronicHistory(input.pastMedicalHistory ?? "", phrases);

  const structured = extractPatientAllergies(input.baselineExamFindings);
  const fromHistory = parseHistoryAllergies(input.pastMedicalHistory ?? "");
  const allergies = [...new Set([...structured, ...fromHistory.declared])];
  const allergiesSummary =
    allergies.length > 0
      ? allergies.join(", ")
      : fromHistory.denied || structured.length === 0
        ? "Nessuna allergia nota."
        : "Nessuna allergia nota.";

  const setting = normalizeSetting(
    input.setting,
    [input.setting, input.presentation, input.description, input.title].filter(Boolean).join(" "),
  );

  return {
    name,
    age,
    sex,
    displayTitle,
    triageAnamnesis,
    clinicalHistory,
    allergies,
    allergiesSummary,
    setting,
    coherenceNotes: notes,
  };
}
