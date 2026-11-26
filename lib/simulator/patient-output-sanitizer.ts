/**
 * Surgical gate on the patient's spoken line.
 * Removes an unfilled slot or a leaked instruction label.
 * Never replaces a real answer with the opening greeting.
 */

export type SanitizePatientOptions = {
  /** 1-based count of clinician messages already in the dialogue, including the current one. */
  turn?: number;
  /** Short lived complaint used only to fill an empty slot token. */
  symptomPhrase?: string | null;
  patientName?: string | null;
};

const UNFILLED_SLOT =
  /\[(?:sintomi attuali|sintomi|sintomo|nome|et[aà])\]|\{\{[^{}]{1,60}\}\}/gi;

const SPEAKER_LABEL =
  /^\s*\[(?:paziente|medico|assistant|user|system|patient|doctor)\]\s*:?\s*/i;

const LEAK_LINE =
  /\b(verit[aà]\s+anamnestica|ground_truth_constraints|system prompt|<\/?ground_truth)/i;

const STAGE_DIRECTION =
  /\[(?:geme|urla|brividi|batte i denti|stringe i pugni|tiene il ginocchio|si tocca la tempia|mostra il polpastrello|mostra il metotrexato)\]/gi;

function tidy(value: string): string {
  return value.replace(/[ \t]{2,}/g, " ").replace(/\s+([,.;!?])/g, "$1").trim();
}

function fillSlot(token: string, options: SanitizePatientOptions): string {
  const inner = token.replace(/[\[\]{}]/g, "").trim().toLowerCase();
  if (inner === "nome") {
    const name = options.patientName?.trim();
    return name && !/\[/.test(name) ? name : "";
  }
  if (/sintom/.test(inner)) {
    const symptom = options.symptomPhrase?.trim() ?? "";
    if (!symptom || /\[|non sto bene, e per questo sono venut/i.test(symptom)) return "";
    return symptom.slice(0, 140);
  }
  return "";
}

/**
 * Cleans one patient utterance. A turn after the first keeps every real sentence.
 */
export function sanitizePatientUtterance(
  text: string,
  options: SanitizePatientOptions = {},
): string {
  let value = text ?? "";
  for (let i = 0; i < 3; i += 1) {
    const next = value.replace(SPEAKER_LABEL, "");
    if (next === value) break;
    value = next;
  }
  value = value
    .split(/\n/)
    .filter((line) => !LEAK_LINE.test(line))
    .join("\n");
  value = value.replace(STAGE_DIRECTION, " ");
  value = value.replace(UNFILLED_SLOT, (token) => fillSlot(token, options));
  return tidy(value);
}

/**
 * Streaming filter. Holds an unfinished bracket so a slot is not painted,
 * then deletes only that token. The rest of the reply is forwarded as spoken.
 */
export function createPatientOutputFilter(options: SanitizePatientOptions = {}) {
  let pending = "";

  const flush = (end: boolean): string => {
    let out = "";
    while (pending.length > 0) {
      const open = pending.search(/\[|\{\{/);
      if (open === -1) {
        out += pending;
        pending = "";
        break;
      }
      out += pending.slice(0, open);
      const tail = pending.slice(open);
      const curly = tail.startsWith("{{");
      const closeAt = curly ? tail.indexOf("}}") : tail.indexOf("]");
      if (closeAt === -1) {
        const hold =
          !end &&
          (curly
            ? tail.length <= 64 && /^\{\{[^{}]*$/.test(tail)
            : tail.length <= 48 && /^\[[^\]]*$/.test(tail));
        if (hold) {
          pending = tail;
          break;
        }
        out += tail[0] ?? "";
        pending = tail.slice(1);
        continue;
      }
      const span = closeAt + (curly ? 2 : 1);
      out += sanitizePatientUtterance(tail.slice(0, span), options);
      pending = tail.slice(span);
    }
    return out;
  };

  return {
    push(delta: string): string {
      pending += delta;
      return flush(false);
    },
    finish(): string {
      const tail = flush(true);
      return tail;
    },
  };
}
