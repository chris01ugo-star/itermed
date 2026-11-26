import { usablePatientPrompt } from "@/lib/cases/case-payload";
import { patientSafeProse } from "@/lib/cases/resolve-patient-profile";
import { resolvePatientGrammaticalGender } from "@/lib/simulator/patient-grammatical-gender";

/**
 * Unfilled bracket slots the patient must never say.
 * Same shape the production bug emitted: `[sintomi attuali]`, `[nome]`, `[età]`.
 */
export const PATIENT_PLACEHOLDER_SOURCE = "\\[[A-Za-zÀ-ÿ0-9_ \\t/-]{3,40}\\]";

const PLACEHOLDER = new RegExp(PATIENT_PLACEHOLDER_SOURCE, "g");
const SYMPTOM =
  /\b(dolore|male|fa male|brucia|febbre|febbr|fiato|affanno|dispnea|sangue|sanguin|emorrag|gonfi|nausea|vomit|tosse|catarro|vertigin|sven|confus|debole|stanc|prurit|eruzion|diarrea|stitichezz|palpit|petto|addome|testa|cefalea|nuca|brivid|freddo|caldo|vista|velo|rigid|formicol|intorpid|urina|peso|pallid|luce|mamma|collo)\b/i;
const INSTRUCTION =
  /\b(roleplay|registro:|non dire tu|non nominare|esempio:|se chiedono|se insistono|se ti |se propongono|se lasciano|se passano|se arriva|rispondi come|senza diagnosi|prima persona|massimo quattro|non fare discorsi|non fai discorsi|frasi di |poi ti perdi|la madre parla|va prefissata|non proporre)\b/i;
const REACTION =
  /\b(se\s+(mi|il medico|propone|chiede|date|danno|offre|parla|vuole)|non\s+voglio|rifiut\w*|accett\w*\s+se)\b/i;
const EMPTY_FACT =
  /motivo di accesso da raccogliere|sintomi da inquadrare|non specificat|usa il copione|^\(non\b|^\(nessun/i;

const STAGE_TO_PROSE: Array<[RegExp, string]> = [
  [/\[\s*batte i denti\s*\]/gi, "mi battono i denti"],
  [/\[\s*brividi\s*\]/gi, "ho i brividi"],
  [/\[\s*geme\s*\]/gi, ""],
  [/\[\s*urla\s*\]/gi, ""],
  [/\[\s*stringe i pugni\s*\]/gi, ""],
  [/\[\s*tiene il ginocchio\s*\]/gi, "mi tengo il ginocchio"],
  [/\[\s*si tocca la tempia\s*\]/gi, "mi fa male la tempia"],
  [/\[\s*mostra il polpastrello\s*\]/gi, ""],
  [/\[\s*mostra il metotrexato\s*\]/gi, ""],
];

export type PatientOpeningInput = {
  chiefComplaint?: string | null;
  presentation?: string | null;
  patientPrompt?: string | null;
  clinicalStory?: string | null;
  physicalExamSummary?: string | null;
  patientName?: string | null;
  patientSex?: string | null;
};

function tidy(value: string): string {
  return value.replace(/\s+/g, " ").replace(/\s+([,.;!?])/g, "$1").trim();
}

function placeholderPattern(): RegExp {
  return new RegExp(PLACEHOLDER.source, "g");
}

export function hasPatientPlaceholder(text: string | null | undefined): boolean {
  if (!text) return false;
  return new RegExp(PLACEHOLDER.source).test(text);
}

/** Turns stage directions into words, then deletes every remaining bracket slot. */
export function scrubPatientBrackets(text: string | null | undefined): string {
  let value = text ?? "";
  for (const [pattern, replacement] of STAGE_TO_PROSE) {
    value = value.replace(pattern, replacement);
  }
  value = value.replace(placeholderPattern(), " ");
  return tidy(value);
}

function sentencesOf(text: string): string[] {
  return text
    .split(/\n+|(?<=[.!?])\s+|»\s+/)
    .map((part) => tidy(part.replace(/^«+|»+$/g, "")))
    .filter((part) => part.length >= 8);
}

function quotedLines(text: string): string[] {
  const out: string[] = [];
  const pattern = /«([^»]+)»/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const line = scrubPatientBrackets(match[1] ?? "");
    if (line.length >= 8 && !INSTRUCTION.test(line) && !EMPTY_FACT.test(line)) out.push(line);
  }
  return out;
}

function asLivedClause(sentence: string, sex: "M" | "F" | null): string {
  let text = scrubPatientBrackets(sentence)
    .replace(/^(?:uomo|donna|paziente|signore|signora)\b[^.]{0,48},\s*/i, "")
    .replace(/\bfebbre assente\b/gi, "non ho febbre")
    .replace(/\bniente emorragia maggiore\b/gi, "non ho un sanguinamento importante")
    .replace(/\bniente sanguinamento maggiore\b/gi, "non ho un sanguinamento importante")
    .replace(/\b(?:il|la)\s+paziente\s+ha\b/gi, "ho")
    .replace(/\briferisce di avere\b/gi, "ho")
    .replace(/\briferisce di\b/gi, "")
    .replace(/\briferisce\b/gi, "");
  if (!/\b(io|ho|mi|sono|sento|sto)\b/i.test(text) && /\bha\b/i.test(text)) {
    text = text.replace(/\bha\b/i, "ho");
  }
  if (sex === "F") text = text.replace(/\bsono pallido\b/gi, "sono pallida");
  if (sex === "M") text = text.replace(/\bsono pallida\b/gi, "sono pallido");
  text = text.replace(/(?<!sono )\bpallida\b/gi, sex === "M" ? "sono pallido" : "sono pallida");
  return tidy(text).replace(/[.…]+$/g, "");
}

function scoreSentence(sentence: string, quoted: boolean): number {
  if (EMPTY_FACT.test(sentence) || INSTRUCTION.test(sentence) || REACTION.test(sentence)) return -5;
  let score = quoted ? 5 : 0;
  if (/\b(ho|mi|sono|sento|sto)\b/i.test(sentence)) score += 2;
  if (SYMPTOM.test(sentence)) score += 3;
  if (sentence.length < 12) score -= 2;
  return score;
}

function finishOpening(body: string): string {
  const cleaned = scrubPatientBrackets(body)
    .replace(/^buongiorno[.,]?\s*/i, "")
    .replace(/non sto bene, e per questo sono venut[oa] qui\.?/gi, "")
    .trim();
  if (cleaned.length < 8 || hasPatientPlaceholder(cleaned) || /sintomi attuali/i.test(cleaned)) {
    return "";
  }
  return cleaned.length > 280 ? `${cleaned.slice(0, 279).trim()}…` : cleaned;
}

/**
 * First-person opening from the case's own complaint.
 * Never returns a square-bracket slot.
 */
export function buildPatientOpeningMessage(input: PatientOpeningInput): string {
  const sex = resolvePatientGrammaticalGender(input.patientSex);
  const sources = [
    usablePatientPrompt(input.patientPrompt),
    input.presentation,
    input.chiefComplaint,
    input.clinicalStory,
    input.physicalExamSummary,
  ];
  const ranked: Array<{ score: number; text: string }> = [];
  for (const source of sources) {
    const safe = patientSafeProse(source);
    if (!safe) continue;
    const quotes = new Set(quotedLines(safe).map((line) => line.toLowerCase()));
    for (const sentence of sentencesOf(safe)) {
      const lived = asLivedClause(sentence, sex);
      if (lived.length < 8) continue;
      const score = scoreSentence(lived, quotes.has(lived.toLowerCase()) || quotes.has(sentence.toLowerCase()));
      if (score >= 3) ranked.push({ score, text: lived });
    }
    if (ranked.length > 0) break;
  }
  if (ranked.length === 0) {
    for (const source of sources) {
      const safe = patientSafeProse(source);
      for (const sentence of sentencesOf(safe)) {
        const lived = asLivedClause(sentence, sex);
        const score = scoreSentence(lived, false);
        if (score >= 1) ranked.push({ score, text: lived });
      }
      if (ranked.length > 0) break;
    }
  }
  ranked.sort((a, b) => b.score - a.score);
  const unique: string[] = [];
  for (const row of ranked) {
    if (unique.some((item) => item.toLowerCase() === row.text.toLowerCase())) continue;
    unique.push(row.text);
    if (unique.length >= 2) break;
  }
  return finishOpening(unique.join(". "));
}
