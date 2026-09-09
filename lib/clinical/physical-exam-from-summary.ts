/**
 * Derive per-district physical-exam findings from a single authored summary
 * plus Killip / vitals, so addome and torace never share one copied sentence.
 */

export type KillipClass = "I" | "II" | "III" | "IV";

export type DerivedPhysicalExam = {
  generale: string;
  cardiovascolare: string;
  torace: string;
  addomeInspection: string;
  addomePalpation: string;
  addomePercussion: string;
};

function firstSentence(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  const match = trimmed.match(/^(.+?[.!?])(?:\s|$)/);
  return (match?.[1] ?? trimmed).trim();
}

function sentencesMatching(text: string, pattern: RegExp): string | null {
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const hits = parts.filter((part) => pattern.test(part));
  return hits.length > 0 ? hits.join(" ") : null;
}

export function lungFindingFromKillip(killip: KillipClass | null | undefined): string {
  switch (killip) {
    case "II":
      return "Rantoli crepitanti alle basi; murmure vescicolare ridotto inferiormente.";
    case "III":
      return "Rantoli crepitanti diffusi su più di metà dei campi polmonari.";
    case "IV":
      return "Rantoli diffusi; paziente ipoperfuso.";
    default:
      return "Murmure vescicolare conservato; assenza di rantoli franchi.";
  }
}

export function derivePhysicalExamFromSummary(input: {
  summary?: string | null;
  killipClass?: KillipClass | null;
  heartRate?: number | null;
  /** Title / presentation — used only to spot bedside signs (e.g. massa pulsante). */
  context?: string | null;
}): DerivedPhysicalExam {
  const summary = (input.summary ?? "").replace(/\s+/g, " ").trim();
  const context = `${summary} ${input.context ?? ""}`;
  const hr = input.heartRate;
  const hrBit = typeof hr === "number" && Number.isFinite(hr) ? ` a ${Math.round(hr)} bpm` : "";

  const abdomenText = sentencesMatching(
    summary,
    /addom|massa|pulsatil|epigastr|periton|difesa|murphy|mesogastr/i,
  );
  const lungText = sentencesMatching(
    summary,
    /polmon|rantol|murmure|vescicolare|crepit|dispnea|torace/i,
  );
  const heartText = sentencesMatching(
    summary,
    /soffi|toni |aritm|tachicard|bradicard|giugul|cardiaco/i,
  );

  const mentionsPulsatile = /massa pulsatil|massa pulsante|pulsatil/i.test(context);
  const mentionsTense = /addome teso|teso e dolente|dolente alla palpazione/i.test(summary);

  const addomeInspection = abdomenText
    ? mentionsTense
      ? "Addome teso."
      : firstSentence(abdomenText)
    : "Addome piano, non meteorico.";

  const addomePalpation = abdomenText
    ? mentionsPulsatile
      ? "Addome teso e dolente; massa pulsante in mesogastrio, dolorabile. Non difesa generalizzata."
      : mentionsTense
        ? "Addome dolente alla palpazione; non difesa generalizzata."
        : firstSentence(abdomenText)
    : "Trattabile, non dolente; non difesa né peritonismo.";

  const addomePercussion = abdomenText
    ? "Percussione addominale ottusa o timpanica in modo non uniforme; non si esprime un giudizio diagnostico."
    : "Timpanismo fisiologico.";

  const cardiovascolare =
    heartText ??
    `Toni ritmici${hrBit}; soffi assenti.`;

  const torace = lungText ?? lungFindingFromKillip(input.killipClass);

  const generale =
    firstSentence(summary) ||
    `Paziente vigile${hrBit ? `, frequenza${hrBit}` : ""}.`;

  return {
    generale,
    cardiovascolare,
    torace,
    addomeInspection,
    addomePalpation,
    addomePercussion,
  };
}
