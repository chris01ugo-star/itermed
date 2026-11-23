import {
  filterLabConversationByTarget,
  type LabCaseBlueprint,
  type LabInterlocutor,
  type LabInterprofessionalEntry,
  type LabWorkbenchState,
} from "@/lib/simulator/laboratory-workbench";

/**
 * Frase unica delle guardie anti-spoiler, condivisa dai due interlocutori.
 * Resta nel prefisso stabile del system prompt.
 */
export const LAB_LINE_ANTI_SPOILER =
  "Non citare codici interni del caso, nomi di linee guida (incluse SIBioC), punteggi, e non dire al patologo se deve validare, sopprimere o notificare.";

const READ_BACK_PATTERN =
  /read[-\s]?back|rilegg\w*|rilettura|ripeto(?:\s+il)?\s+valore|confermo\s+il\s+valore|valore\s+confermato|ho\s+confermato\s+il\s+valore/i;

const FILL_LEVEL: Record<LabCaseBlueprint["investigations"]["sampleInspection"]["fillLevel"], string> = {
  ADEQUATE: "adeguato",
  UNDERFILLED: "sotto il segno",
  OVERFILLED: "sopra il segno",
  EMPTY: "vuota",
};

const CLOT: Record<LabCaseBlueprint["investigations"]["sampleInspection"]["clotCheck"], string> = {
  ABSENT: "assente",
  PRESENT: "presente",
  NOT_ASSESSED: "non ancora guardato",
};

const LABEL: Record<LabCaseBlueprint["investigations"]["sampleInspection"]["labelIntegrity"], string> = {
  INTACT: "integra e coerente",
  MISMATCH: "non coincide col paziente",
  MISSING: "mancante",
};

const FLAG_LABEL: Record<LabCaseBlueprint["analytes"][number]["flag"], string> = {
  NORMAL: "nei limiti dello strumento",
  HIGH: "alto sullo strumento",
  LOW: "basso sullo strumento",
  CRITICAL_HIGH: "allarme alto dello strumento",
  CRITICAL_LOW: "allarme basso dello strumento",
};

function ticketBlock(blueprint: LabCaseBlueprint): string {
  const demo = blueprint.patientDemographics;
  const analytes = blueprint.analytes
    .map((analyte) => {
      const signals = analyte.instrumentFlags.length > 0 ? analyte.instrumentFlags.join(", ") : "nessuno";
      const delta = analyte.deltaCheck
        ? ` Delta: precedente ${analyte.deltaCheck.previousValue} il ${analyte.deltaCheck.previousDate}.`
        : "";
      return `- ${analyte.name}: ${analyte.value} ${analyte.unit} (riferimento ${analyte.refRange}), ${FLAG_LABEL[analyte.flag]}. Segnali: ${signals}.${delta}`;
    })
    .join("\n");
  return [
    "BANCO LIS — DATI STABILI DEL CASO",
    `Accettazione ${blueprint.accessionNumber}, reparto ${blueprint.ward}, priorità ${blueprint.priority}, SLA accettazione ${blueprint.slaMinutes} minuti.`,
    `Paziente: ${demo.age} anni, sesso ${demo.sex}. Contesto: ${demo.wardContext}.`,
    `Richiesta visibile in accettazione: ${blueprint.clinicalOrderSummary}`,
    "Analiti sul ticket:",
    analytes,
  ].join("\n");
}

function investigationBlock(blueprint: LabCaseBlueprint): string {
  const sample = blueprint.investigations.sampleInspection;
  const hil = blueprint.investigations.hilIndices;
  const qc = blueprint.investigations.qcStatus;
  const morph = blueprint.investigations.morphologyOrTrace;
  const lines = [
    "EVIDENZE DI BANCO",
    `Provetta: ${sample.tubeType}. Riempimento ${FILL_LEVEL[sample.fillLevel]}. Coagulo ${CLOT[sample.clotCheck]}. Etichetta ${LABEL[sample.labelIntegrity]}. Dal prelievo all'accettazione: ${sample.collectionToReceiptMin} minuti. Nota visiva: ${sample.visualNote}.`,
    `Indici HIL: emolisi ${hil.hemolysisIndex}, ittero ${hil.icterusIndex}, lipemia ${hil.lipemiaIndex}. ${hil.wavelengthNote} Analiti toccati: ${
      hil.affectedAnalytes.length > 0
        ? hil.affectedAnalytes
            .map((token) => blueprint.analytes.find((analyte) => analyte.id === token)?.name ?? token)
            .join(", ")
        : "nessuno"
    }.`,
    `Controllo di qualità ${qc.analyzerLine}: ${qc.status === "IN_CONTROL" ? "in controllo" : "warning Westgard"}. ${qc.summary}`,
  ];
  if (morph) {
    const metrics = morph.keyMetrics
      ? ` Misure: ${Object.entries(morph.keyMetrics)
          .map(([key, value]) => `${key} ${value}`)
          .join("; ")}.`
      : "";
    lines.push(`${morph.title}: ${morph.findings}${metrics}`);
  } else {
    lines.push("Striscio, tracciato elettroforetico o scattergram: non previsti su questo campione.");
  }
  return lines.join("\n");
}

function orderedReflexLines(blueprint: LabCaseBlueprint, state: LabWorkbenchState): string {
  if (state.requestedReflexIds.length === 0) return "Nessun reflex già eseguito su questo banco.";
  return state.requestedReflexIds
    .map((order) => {
      const reflex = blueprint.reflexCatalog.find((item) => item.id === order.id);
      if (!reflex) return "- Un reflex richiesto non è più nel catalogo del caso.";
      return `- ${reflex.name}: ${reflex.resultSummary}`;
    })
    .join("\n");
}

function sessionTail(
  blueprint: LabCaseBlueprint,
  state: LabWorkbenchState,
  target: LabInterlocutor,
): string {
  const opened =
    state.unlockedInvestigations.length > 0
      ? state.unlockedInvestigations.map((row) => row.id).join(", ")
      : "nessuna";
  const prior = filterLabConversationByTarget(state.interprofessionalLog, target).length;
  const lines = [
    "STATO SESSIONE",
    `Scambi già avvenuti con questo interlocutore nella finestra recente: ${prior}.`,
  ];
  if (target === "tslb") {
    lines.push(`Pannello Banco già aperto dal patologo: ${opened}.`);
    lines.push("Reflex già richiesti:");
    lines.push(orderedReflexLines(blueprint, state));
    lines.push(
      "Se un'evidenza non è ancora aperta sul pannello, puoi comunque dire ciò che vedi sulla provetta. Non trasformare questa frase in un consiglio di validazione.",
    );
  }
  return lines.join("\n");
}

function tslbBlock(blueprint: LabCaseBlueprint): string {
  const persona = blueprint.personas.tslb;
  return [
    "RUOLO: Tecnico sanitario di laboratorio biomedico al banco.",
    "Tono pragmatico da banco ospedaliero. Rispondi in italiano, in 2-4 frasi, senza lezione accademica.",
    "Rispondi solo con i fatti del tuo briefing e delle evidenze di banco. Se il patologo chiede coagulo, livello di riempimento, citrato, striscio, centrifugazione o di sospendere un OGTT, conferma ciò che risulta da quelle evidenze.",
    `Briefing: ${persona.briefing}`,
    `Puoi eseguire o verificare: ${persona.allowedChecks.join("; ")}.`,
    `Limiti: ${persona.limits}`,
    investigationBlock(blueprint),
    LAB_LINE_ANTI_SPOILER,
  ].join("\n");
}

function clinicianBlock(blueprint: LabCaseBlueprint): string {
  const persona = blueprint.personas.clinician;
  const drugs =
    persona.medicationsAndSupplements.length > 0
      ? persona.medicationsAndSupplements.join("; ")
      : "nessun farmaco o integratore annotato";
  const pressures =
    persona.pressures.length > 0 ? persona.pressures.join(" | ") : "nessuna pressione particolare";
  return [
    "RUOLO: Medico richiedente del reparto, del pronto soccorso o del territorio.",
    "Tono da collega al telefono. Rispondi in italiano, in 2-4 frasi, senza lezione accademica.",
    "Anamnesi, farmaci e integratori restano nascosti finché il patologo non fa una domanda mirata. Non anticiparli.",
    `Anamnesi nascosta: ${persona.hiddenHistory}`,
    `Farmaci e integratori: ${drugs}.`,
    `Pressioni realistiche, da riprodurre solo se il dialogo le rende naturali: ${pressures}.`,
    "Read-back: se il patologo comunica un valore critico e chiede conferma o read-back, oppure dichiara in modo chiaro analita, valore e paziente, ripeti quel valore e di' quale azione clinica immediata intraprendi. Non anticipare il read-back.",
    `Copione di read-back, solo in quel caso: ${persona.readBackScript}`,
    LAB_LINE_ANTI_SPOILER,
  ].join("\n");
}

/**
 * System prompt della linea interna.
 * Il ticket stabile precede ruolo e stato, così il prefisso resta cacheable.
 */
export function buildLabInterprofessionalSystemPrompt(input: {
  blueprint: LabCaseBlueprint;
  state: LabWorkbenchState;
  target: LabInterlocutor;
}): string {
  const role = input.target === "tslb" ? tslbBlock(input.blueprint) : clinicianBlock(input.blueprint);
  return [
    ticketBlock(input.blueprint),
    role,
    sessionTail(input.blueprint, input.state, input.target),
  ].join("\n\n");
}

function valueAppears(reply: string, value: string): boolean {
  const needle = value.trim().toLowerCase().replace(/,/g, ".");
  if (!needle) return false;
  const haystack = reply.toLowerCase().replace(/,/g, ".");
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![0-9.])${escaped}(?![0-9.])`, "i").test(haystack);
}

/**
 * Segnale informativo: il clinico ha riletto un valore critico.
 * Non registra la notifica e non sostituisce il gesto del patologo sul banco.
 */
export function detectReadBackSignal(clinicianReply: string, blueprint: LabCaseBlueprint): boolean {
  const reply = clinicianReply.trim();
  if (!reply || !READ_BACK_PATTERN.test(reply)) return false;
  return blueprint.analytes.some(
    (analyte) =>
      (analyte.flag === "CRITICAL_HIGH" || analyte.flag === "CRITICAL_LOW") &&
      valueAppears(reply, analyte.value),
  );
}

export function labelLabLogEntry(row: LabInterprofessionalEntry): string {
  if (row.role === "user") {
    const lane =
      row.target === "tslb" ? "TSLB" : row.target === "clinician" ? "Medico richiedente" : "linea interna";
    return `[Patologo → ${lane}] ${row.content}`;
  }
  const speaker = row.role === "tslb" ? "TSLB" : "Medico richiedente";
  return `[${speaker}] ${row.content}`;
}

/** Log compatto per l'esaminatore: distingue il banco dal medico richiedente. */
export function formatLabInterprofessionalLog(
  log: readonly LabInterprofessionalEntry[],
  maxTurns = 12,
): string {
  const limit = Number.isFinite(maxTurns) ? Math.max(0, Math.floor(maxTurns)) : 12;
  const window = log.slice(-limit);
  if (window.length === 0) return "Nessun dialogo sulla linea interna.";
  return window.map((row) => labelLabLogEntry(row)).join("\n");
}
