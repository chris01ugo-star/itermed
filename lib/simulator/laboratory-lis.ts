/** Playable LIS step. Scores, traps and gold paths stay on the server. */
export type LabFlowChoice = {
  id: string;
  label: string;
  next: string;
};

export type LabFlowNode = {
  id: string;
  type: "decision" | "resolution";
  title: string;
  prompt: string;
  outcome?: "positive" | "negative";
  choices?: LabFlowChoice[];
};

export type LabActionTone = "critical" | "reject" | "primary" | "neutral";

export type LabSampleBadge = {
  label: string;
  className: string;
};

/**
 * Laboratory module only. Includes the DB label "Medicina di Laboratorio"
 * and the authored id prefix LABO-.
 */
export function isLaboratoryCase(input: {
  specialty?: string | null;
  id?: string | null;
}): boolean {
  const specialty = input.specialty?.toLowerCase();
  return (
    specialty === "medicina_laboratorio" ||
    specialty === "laboratorio" ||
    specialty === "medicina di laboratorio" ||
    Boolean(input.id?.startsWith("LABO-"))
  );
}

export function parseLabFlow(raw: unknown): LabFlowNode[] | null {
  if (!raw || typeof raw !== "object") return null;
  const nodes = (raw as { nodes?: unknown }).nodes;
  if (!Array.isArray(nodes)) return null;

  const parsed: LabFlowNode[] = [];
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    const record = node as Record<string, unknown>;
    if (record.type !== "decision" && record.type !== "resolution") continue;
    if (typeof record.id !== "string" || typeof record.title !== "string" || typeof record.prompt !== "string") {
      continue;
    }
    const choices = Array.isArray(record.choices)
      ? record.choices.flatMap((choice) => {
          if (!choice || typeof choice !== "object") return [];
          const item = choice as Record<string, unknown>;
          if (typeof item.id !== "string" || typeof item.label !== "string" || typeof item.next !== "string") {
            return [];
          }
          return [{ id: item.id, label: item.label, next: item.next }];
        })
      : undefined;
    parsed.push({
      id: record.id,
      type: record.type,
      title: record.title,
      prompt: record.prompt,
      outcome: record.outcome === "positive" || record.outcome === "negative" ? record.outcome : undefined,
      choices: choices && choices.length > 0 ? choices : undefined,
    });
  }
  return parsed.length > 0 ? parsed : null;
}

/** Visual tone only. The click handler still receives the choice id. */
export function classifyLabAction(label: string): LabActionTone {
  const text = label.trim().toLowerCase();
  const negated = /^(non|nessun|nessuna)\b/.test(text);
  if (
    !negated &&
    (/chiama(?:re)?\s+.*reparto/.test(text) || /telefono subito il reparto/.test(text))
  ) {
    return "critical";
  }
  if (/\bc-ni\b|\bc-coag\b|rigetta|non idone|blocco il risultato|\bferma\b/.test(text)) {
    return "reject";
  }
  if (!negated && /\b(valida|validare|refert|reflex|esegui)\b/.test(text)) {
    return "primary";
  }
  return "neutral";
}

export function labSampleBadges(text: string): LabSampleBadge[] {
  const source = text.toLowerCase();
  const badges: LabSampleBadge[] = [];
  if (/emolis/.test(source)) {
    badges.push({ label: "EMOLISI ++", className: "border-transparent bg-red-500 text-white" });
  }
  if (/itter/.test(source)) {
    badges.push({ label: "ITTERICO", className: "border-transparent bg-yellow-400 text-yellow-950" });
  }
  if (/coagul/.test(source)) {
    badges.push({ label: "COAGULATO", className: "border-transparent bg-red-500 text-white" });
  }
  if (badges.length > 0) return badges;
  if (/citrato|edta|lipem|discord|non etichett|sotto.?riemp|identificaz/.test(source)) {
    return [{ label: "VERIFICA PREANALITICA", className: "border-transparent bg-slate-700 text-white" }];
  }
  return [{ label: "CAMPIONE IDONEO", className: "border-transparent bg-emerald-600 text-white" }];
}

export function labRequestLooksExpensive(text: string): boolean {
  return /ngs|western|400\s*euro|67[,.]20|pannello da\s+\d+\s+geni/i.test(text);
}

export function labConsentRecorded(text: string): boolean {
  const source = text.toLowerCase();
  if (/senza consenso|consenso.*(vuot|assente|mancante)|checkbox vuot|non c'è il consenso|manca il consenso/.test(source)) {
    return false;
  }
  return /consenso informato (acquisit|registrat|presente)|spunta.*219|legge 219.*s[iì]/.test(source);
}
