/**
 * Rubrica neuro-psicologica dell'empatia clinica.
 * Quattro assi osservabili e la dinamica turno-per-turno.
 * Il coaching cita solo frasi realmente presenti nel colloquio.
 */

export const EMPATHY_NEURO_AXES = [
  "Mentalizzazione e empatia cognitiva (mPFC/TPJ, modello ICE)",
  "Risonanza affettiva e regolazione (insula/dACC, affect labeling)",
  "Alleanza e agenzia condivisa (CARE, SPIKES, L. 219/2017 art. 1)",
  "Dinamica Suchman e rupture-repair (Safran e Muran)",
] as const;

export const EMPATHY_NEURO_PROMPT_APPENDIX = `
TASSONOMIA NEURO-PSICOLOGICA (da applicare alle etichette, senza inventare punteggi):
1. Mentalizzazione (mPFC/TPJ): ICE di Leventhal — idee, preoccupazioni, aspettative — e registro senza gergo opaco. Esempio buono: "Che idea si è fatto di questo dolore?".
2. Risonanza affettiva (insula anteriore/dACC): affect labeling di Lieberman. La validazione autentica nomina l'emozione del paziente. L'equanimità clinica resta presente senza fondersi. La rassicurazione formulaica ("stia tranquillo", "andrà tutto bene") aumenta l'allarme: è FORMULAIC_EMPATHY, non VALIDATION.
3. Alleanza (CARE, SPIKES, Self-Determination Theory, teach-back, L. 219/2017 art. 1): spiegare, poi chiedere cosa ha capito, e decidere insieme. Esempio: "Le ripeto con parole mie: vuole restare in osservazione, non andare subito a casa. Ho capito bene?".
4. Suchman: un cue emotivo del paziente chiede un continuer ("mi dica di questa paura"), non un terminator che cambia argomento. Safran e Muran: dopo una fase tecnica o una rottura, il ritorno sul vissuto è rupture-repair e va premiato.
5. URGENZA: una domanda anamnestica rapida in pronto soccorso NON è EMOTIONAL_BYPASS se il paziente non ha appena espresso un cue emotivo ignorato.
`;

const CUE_RE =
  /\b(paura|spavent|ansia|angosc|piang|morir|grave|solo|abbandon|non ce la faccio|terrore|preoccup)\w*/i;
const FORMULAIC_RE = /\b(stia tranquillo|stai tranquillo|andrà tutto bene|andra tutto bene|non si preoccupi|va tutto bene)\b/i;
const VALIDATION_RE = /\b(capisco|la paura|vedo che|è comprensibile|e comprensibile|deve essere stato|questo la)\b/i;

export type EmpathyCoaching = {
  strengths: string[];
  missed: string[];
  trajectory: string;
  text: string;
};

function clipQuote(text: string, max = 120): string {
  const tidy = text.replace(/\s+/g, " ").trim();
  if (tidy.length <= max) return tidy;
  return `${tidy.slice(0, max - 1).trim()}…`;
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 8);
}

export function buildEmpathyNeuroCoaching(
  chat: Array<{ role: string; content: string }> | null | undefined,
): EmpathyCoaching {
  const turns = Array.isArray(chat) ? chat : [];
  const strengths: string[] = [];
  const missed: string[] = [];
  let cues = 0;
  let captured = 0;
  let repairs = 0;
  let ruptureOpen = false;

  for (let index = 0; index < turns.length; index += 1) {
    const turn = turns[index];
    const content = typeof turn?.content === "string" ? turn.content.trim() : "";
    if (!content) continue;
    if (turn.role === "assistant" && CUE_RE.test(content)) {
      cues += 1;
      const next = turns.slice(index + 1).find((item) => item.role === "user" && item.content?.trim());
      const reply = next?.content?.trim() ?? "";
      if (!reply) {
        missed.push(
          `Cue non raccolto («${clipQuote(content)}»): il medico non è tornato sul vissuto.`,
        );
        ruptureOpen = true;
        continue;
      }
      if (FORMULAIC_RE.test(reply)) {
        missed.push(
          `Frase formulaica «${clipQuote(reply, 80)}» dopo «${clipQuote(content, 80)}». Meglio: «Capisco che ${clipQuote(content, 60).toLowerCase()} La spaventa. Restiamo su questo un momento, poi le dico cosa facciamo.»`,
        );
        ruptureOpen = true;
        continue;
      }
      if (VALIDATION_RE.test(reply) || CUE_RE.test(reply)) {
        captured += 1;
        if (strengths.length < 2) {
          const quote = sentences(reply)[0] ?? reply;
          strengths.push(
            `«${clipQuote(quote)}» — affect labeling: nominare il vissuto riduce l'attivazione dell'amigdala e tiene aperta l'alleanza.`,
          );
        }
        if (ruptureOpen) repairs += 1;
        ruptureOpen = false;
        continue;
      }
      if (reply.length < 80 && !CUE_RE.test(content)) continue;
      missed.push(
        `Dopo «${clipQuote(content, 80)}» la risposta resta sul compito. Un continuer possibile: «Prima di proseguire: cosa la preoccupa di più in questo momento?».`,
      );
      ruptureOpen = true;
    }
  }

  const doctorLines = turns
    .filter((turn) => turn.role === "user" && turn.content?.trim())
    .map((turn) => turn.content.trim());
  if (strengths.length === 0) {
    const anchored = doctorLines.find((line) => VALIDATION_RE.test(line) && !FORMULAIC_RE.test(line));
    if (anchored) {
      strengths.push(
        `«${clipQuote(sentences(anchored)[0] ?? anchored)}» — registro ancorato al paziente, senza gergo opaco.`,
      );
    }
  }

  const trajectory =
    doctorLines.length === 0
      ? "Nessun turno del medico: alleanza non osservabile."
      : cues === 0
        ? "Nessun cue emotivo esplicito. Le domande cliniche focalizzate non sono un bypass emotivo."
        : repairs > 0
          ? "Traiettoria con riparazione: dopo una fase tecnica il medico è tornato sul vissuto."
          : captured > 0
            ? "Alleanza tenuta: almeno un cue è stato nominato prima di tornare al compito."
            : "Carico emotivo non raccolto: i cue sono stati chiusi da un terminator o da una formula.";

  const text = [
    strengths.length ? `Punti di forza: ${strengths.join(" ")}` : "",
    missed.length ? `Opportunità: ${missed.slice(0, 2).join(" ")}` : "",
    trajectory,
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 900);

  return { strengths, missed, trajectory, text };
}

export function mergeEmpathyCoaching(params: {
  neuro: EmpathyCoaching | string;
  ragFeedback?: string | null;
  empathyChunksPresent?: boolean;
}): string {
  const neuroText = typeof params.neuro === "string" ? params.neuro.trim() : params.neuro.text.trim();
  const rag = params.ragFeedback?.trim() ?? "";
  if (!neuroText) return rag;
  if (!params.empathyChunksPresent || !rag) return neuroText;
  return `${neuroText} Riferimento del pilastro empatia, senza sostituire le citazioni dei turni: ${rag}`.slice(0, 900);
}
