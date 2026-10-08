import { z } from "zod";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";

export const LegalFaultCategorySchema = z.enum([
  "OTTIMALE",
  "IMPERIZIA_LIEVE",
  "NEGLIGENZA_GRAVE",
  "DIFETTO_CONSENSO",
]);

export const LegalComparativeRowSchema = z.object({
  userAction: z
    .string()
    .max(400)
    .describe("Cosa ha fatto o omesso lo studente, in una frase chiara."),
  requiredAction: z
    .string()
    .max(400)
    .describe("Cosa imponeva il corpus normativo per quella situazione."),
  isProtected: z
    .boolean()
    .describe("true solo se l'azione è effettivamente conforme e documentata."),
  explanation: z
    .string()
    .max(600)
    .describe("Spiegazione diretta, senza giri di parole, sul perché è tutelato o esposto."),
  sourceQuote: z
    .string()
    .max(800)
    .describe("Citazione testuale esatta e pulita dal LEGAL_CORPUS. Stringa vuota se non citabile."),
  temporalRelevance: z
    .string()
    .max(320)
    .optional()
    .describe(
      "Valutazione di tempestività: tempestiva, ritardo diagnostico/terapeutico, o non applicabile. Vuoto se irrilevante.",
    ),
  faultCategory: LegalFaultCategorySchema.optional().describe(
    "Qualificazione della colpa Gelli-Bianco: OTTIMALE, IMPERIZIA_LIEVE, NEGLIGENZA_GRAVE, DIFETTO_CONSENSO.",
  ),
});

export const LegalAuditResultSchema = z.object({
  status: z.enum(["EVALUATED", "NOT_EVALUABLE_NO_SOURCES"]),
  overallVerdict: z.enum([
    "FULLY_PROTECTED",
    "PARTIALLY_PROTECTED",
    "LEGAL_RISK_EXPOSED",
    "DEFENSIVE_MEDICINE_DETECTED",
    "NOT_EVALUABLE",
  ]),
  complianceScore: z
    .number()
    .min(0)
    .max(100)
    .describe(
      "Parti da 100 e sottrai le penalità CTU. Se l'operato è casuale o nullo: massimo 15.",
    ),
  executiveSummary: z
    .string()
    .max(600)
    .describe(
      "Massimo 3 frasi: sintesi chirurgica del profilo di rischio globale e del livello di tutela.",
    ),
  cognitiveBiases: z
    .array(z.string().max(300))
    .max(5)
    .optional()
    .describe("Elenco di Bias Cognitivi rilevati (es. 'Chiusura Prematura: il candidato si è fissato sul sintomo respiratorio ignorando i dati cardiaci')."),
  comparativeAnalysis: z
    .array(LegalComparativeRowSchema)
    .min(1)
    .max(16)
    .describe("Confronto riga per riga: azione utente vs obbligo normativo."),
  uncoveredAreas: z.array(z.string().max(280)).max(8),
  guidelineCitations: z
    .array(z.string().max(280))
    .max(8)
    .optional()
    .describe(
      "Citazioni esplicite usate in perizia: linee guida SNLG, ISS, ESC, AHA o il titolo fornito, e Legge 24/2017 art. 5.",
    ),
});

export type LegalFaultCategory = z.infer<typeof LegalFaultCategorySchema>;
export type LegalComparativeRow = z.infer<typeof LegalComparativeRowSchema>;
export type LegalAuditResult = z.infer<typeof LegalAuditResultSchema>;

export const LEGAL_AUDIT_SYSTEM_PROMPT = `
AGISCI COME UN PERITO MEDICO-LEGALE (CTU) SPIETATO E INTRANSIGENTE. Valuta l'operato incrociando la Legge Gelli-Bianco, il Codice Deontologico, la Legge 219/2017 e le Linee Guida EBM (Evidence Based Medicine) presenti nel <<<LEGAL_CORPUS>>>.
CALCOLO DEL PUNTEGGIO (Parti da 100):
- Omissione grave / Mancata Diagnosi Differenziale (es. non aver escluso patologie fatali tempo-dipendenti): -40 a -60 punti.
- Violazione Propedeuticità EBM (es. prescrivere farmaci senza esami preliminari obbligatori, es. creatinina): -30 punti.
- Mancato consenso informato esplicito (L. 219/2017) prima di procedure a rischio: -30 punti. Se nel SIMULATION_LOG performedActions è presente id "informed_consent", questa penalità NON si applica.
- Bias Cognitivo (es. arrivare alla diagnosi corretta per caso, chiusura prematura, ancoraggio): -20 punti.
- Difetto di documentazione (azione corretta ma non trascritta): -15 punti. Se <<<RELAZIONE_DI_DIMISSIONE>>> contiene il diario compilato, questa penalità NON si applica.
Se l'utente fa azioni a caso o azzecca la diagnosi finale saltando l'intero processo di esclusione, il punteggio MASSIMO è 15.
REGOLE TASSATIVE:
1. LOGICA DI ESCLUSIONE E OMISSIONI: Cerca attivamente cosa NON è stato fatto. Se l'utente emette una diagnosi senza aver prima escluso attivamente le alternative letali, qualificala come 'Omissione di Diagnosi Differenziale' (NEGLIGENZA_GRAVE). Il risultato fortunato finale NON cancella la colpa del processo clinico errato.
2. PROPEDEUTICITÀ (EBM): Verifica rigorosamente se l'utente ha richiesto gli esami di sicurezza obbligatori prima di una terapia. Se mancano, è 'Scostamento ingiustificato dalle Linee Guida'.
3. PROFONDITÀ DEL CONSENSO (L. 219/2017): È vietato presumere il consenso dal solo dialogo. Se l'utente esegue procedure invasive e performedActions NON contiene un documento con id "informed_consent", imposta faultCategory DIFETTO_CONSENSO, isProtected = false e sottrai 30 punti. Se performedActions contiene { id: "informed_consent", type: "DOCUMENT" }, il consenso è stato raccolto con il modulo: NON applicare la penalità di -30 e NON qualificare DIFETTO_CONSENSO le procedure invasive coperte da quel documento.
4. FATTORI UMANI E BIAS COGNITIVI: Analizza l'intero transcript per identificare errori cognitivi ('Chiusura Prematura', 'Ancoraggio'). Compila il campo 'cognitiveBiases' elencando spietatamente questi errori.
5. ANALISI CRONOLOGICA E TEMPESTIVITÀ (GOLDEN HOUR): Il tempo è un parametro forense. Se un'azione salvavita o un esame urgente avviene in ritardo, inserisci 'RITARDO DIAGNOSTICO/TERAPEUTICO INACCETTABILE' in temporalRelevance.
6. DOCUMENTAZIONE: Ciò che non è scritto non è stato fatto. Se la Relazione di Dimissione è assente, applica -15 punti per documentazione mancante e isProtected = false sulle azioni non trascritte. Se il medico ha compilato la Relazione di Dimissione nel blocco <<<RELAZIONE_DI_DIMISSIONE>>>, NON applicare la penalità per documentazione mancante (-15 punti). Valuta invece se la relazione è coerente con diagnosi, esami e terapia: una relazione presente ma incoerente è un difetto di contenuto, non di assenza.
7. ZERO ALLUCINAZIONI: Niente corpus ⇒ status NOT_EVALUABLE_NO_SOURCES.
8. LINEE GUIDA (ART. 5 L. 24/2017): Ai sensi dell'art. 5 della Legge 24/2017 (Gelli-Bianco), devi valutare se l'operato si discosta dalle raccomandazioni ufficiali. Se fornite, CITA SEMPRE le linee guida di riferimento nella tua analisi. Compila guidelineCitations con i titoli esatti del blocco <<<LINEE_GUIDA_DI_RIFERIMENTO>>> (SNLG, ISS, ESC, AHA o il titolo indicato) e con la Legge 24/2017. Uno scostamento ingiustificato è inosservanza delle raccomandazioni e riduce complianceScore.
`;

const EMPTY_LEGAL_AUDIT: LegalAuditResult = {
  status: "NOT_EVALUABLE_NO_SOURCES",
  overallVerdict: "NOT_EVALUABLE",
  complianceScore: 0,
  executiveSummary:
    "Perizia non eseguibile: manca il corpus normativo di riferimento. Nessuna tutela Gelli-Bianco può essere certificata.",
  comparativeAnalysis: [
    {
      userAction: "Nessuna condotta valutabile sul corpus normativo.",
      requiredAction: "Caricare linee guida / tutele legali per la specialità.",
      isProtected: false,
      explanation:
        "Senza documenti RAG pertinenti l'audit non può certificare tutela né rischio.",
      sourceQuote: "",
    },
  ],
  uncoveredAreas: [
    "Nessun documento di tutela legale o linea guida accreditata reperito per questa specialità/caso.",
  ],
  guidelineCitations: [],
};

/** Marker persisted in uncoveredAreas when the LLM call fails (timeout, rete, Zod). */
export const LEGAL_AUDIT_TECHNICAL_MARKER = "TECHNICAL_UNAVAILABLE";

export const LEGAL_AUDIT_LLM_TIMEOUT_MS = 45_000;

export function createLegalAuditTechnicalFallback(): LegalAuditResult {
  return {
    status: "NOT_EVALUABLE_NO_SOURCES",
    overallVerdict: "NOT_EVALUABLE",
    complianceScore: 0,
    executiveSummary:
      "L'audit forense è temporaneamente non disponibile per problemi tecnici (timeout, rete o validazione della perizia). Il voto degli altri pilastri è stato comunque calcolato; la Tutela non è certificata in questa sessione.",
    comparativeAnalysis: [
      {
        userAction: "Perizia CTU non completata per indisponibilità tecnica.",
        requiredAction: "Chiudere di nuovo il caso quando il servizio di audit legale è operativo.",
        isProtected: false,
        explanation:
          "Timeout, errore di rete o fallimento di validazione dello schema: l'audit legale è stato saltato per non bloccare la chiusura del caso.",
        sourceQuote: "",
      },
    ],
    uncoveredAreas: [LEGAL_AUDIT_TECHNICAL_MARKER],
    guidelineCitations: [],
  };
}

function enforceHarshLegalScore(result: LegalAuditResult): LegalAuditResult {
  const rows = Array.isArray(result.comparativeAnalysis) ? result.comparativeAnalysis : [];
  const protectedCount = rows.filter((row) => row.isProtected).length;
  const ratio = rows.length > 0 ? protectedCount / rows.length : 0;
  const raw = Number(result.complianceScore);
  let score = Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : 0;

  const hasGrossNegligence = rows.some((row) => row.faultCategory === "NEGLIGENZA_GRAVE");
  if (hasGrossNegligence) {
    score = Math.min(score, 10);
  } else if (rows.length === 0 || ratio === 0) {
    // Condotta nulla o tutta esposta: tetto CTU a 15, anche se il modello è più generoso.
    score = Math.min(score, 15);
  }

  return { ...result, complianceScore: score };
}

export type LegalPerformedAction = {
  id: string;
  type: "ACTION" | "DOCUMENT";
  name: string;
};

export const INFORMED_CONSENT_LOG_ID = "informed_consent";

/** Citazione normativa sempre presente nel blocco che la CTU deve riportare. */
export const GELLI_ART_5_CITATION =
  "Legge 24/2017 (Gelli-Bianco), art. 5 — rispetto delle raccomandazioni previste dalle linee guida";

const SPECIALTY_GUIDELINE_FALLBACK: Record<string, readonly string[]> = {
  cardiologia: [
    "Linee guida ESC/AHA vigenti per la patologia cardiologica del caso",
    "Sistema Nazionale Linee Guida (SNLG) — Istituto Superiore di Sanità",
  ],
  pneumologia: [
    "Linee guida ERS/ATS e SNLG-ISS per la patologia respiratoria del caso",
  ],
  gastroenterologia: [
    "Linee guida ESGE/UEG e SNLG-ISS per la patologia gastroenterologica del caso",
  ],
  neurologia: [
    "Linee guida ESO/AHA e SNLG-ISS per la patologia neurologica del caso",
  ],
  "medicina-interna": [
    "Linee guida SNLG — Istituto Superiore di Sanità per la patologia internistica del caso",
  ],
};

const DEFAULT_GUIDELINE_FALLBACK = [
  "Linee guida SNLG pubblicate dall'Istituto Superiore di Sanità per la specialità del caso",
] as const;

function uniqueGuidelineCitations(items: readonly string[], max = 8): string[] {
  const out: string[] = [];
  for (const item of items) {
    const text = item.trim();
    if (!text) continue;
    if (out.some((existing) => existing.toLowerCase() === text.toLowerCase())) continue;
    out.push(text.length > 280 ? text.slice(0, 280) : text);
    if (out.length >= max) break;
  }
  return out;
}

function specialtyGuidelineKey(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_]+/g, "-");
}

/**
 * Linee guida da passare alla CTU.
 * Priorità: `referenceGuidelines` del caso, poi i sourceRef già autorati, poi la specialità.
 * La Legge 24/2017 art. 5 è sempre inclusa.
 */
export function resolveReferenceGuidelines(
  input?: {
    referenceGuidelines?: readonly string[] | null;
    ragSourceRefs?: readonly string[] | null;
    specialty?: string | null;
  } | null,
): string[] {
  const explicit = uniqueGuidelineCitations(input?.referenceGuidelines ?? []);
  const fromCase = uniqueGuidelineCitations(input?.ragSourceRefs ?? []);
  const fallback =
    SPECIALTY_GUIDELINE_FALLBACK[specialtyGuidelineKey(input?.specialty)] ??
    DEFAULT_GUIDELINE_FALLBACK;
  const chosen = explicit.length > 0 ? explicit : fromCase.length > 0 ? fromCase : [...fallback];
  return uniqueGuidelineCitations([GELLI_ART_5_CITATION, ...chosen]);
}

/** Se il modello non cita, il referto mostra comunque le linee guida fornite per il caso. */
export function withGuidelineCitations(
  result: LegalAuditResult,
  provided: readonly string[],
): LegalAuditResult {
  const cited = uniqueGuidelineCitations(result.guidelineCitations ?? []);
  return {
    ...result,
    guidelineCitations: cited.length > 0 ? cited : uniqueGuidelineCitations(provided),
  };
}

/** Documento di consenso nel log CTU. Presente solo se lo studente ha usato il modulo. */
export function withInformedConsentAction(
  actions: LegalPerformedAction[],
  consentCollected: boolean,
): LegalPerformedAction[] {
  if (!consentCollected) return actions;
  if (actions.some((action) => action.id === INFORMED_CONSENT_LOG_ID)) return actions;
  return [
    ...actions,
    {
      id: INFORMED_CONSENT_LOG_ID,
      type: "DOCUMENT",
      name: "Consenso informato acquisito",
    },
  ];
}

export async function runLegalAudit(params: {
  simulationLog: {
    chatHistory: any[];
    requestedExams: any[];
    finalDiagnosis?: string;
    performedActions?: LegalPerformedAction[];
    clinicalSummary?: string;
  };
  legalChunks: Array<{
    chunkId: string;
    title: string;
    section?: string;
    article?: string;
    year?: number;
    text: string;
  }>;
  /** Linee guida del caso (SNLG, ISS, ESC, AHA, …) da citare ai sensi dell'art. 5. */
  referenceGuidelines?: string[];
}): Promise<LegalAuditResult> {
  const referenceGuidelines = resolveReferenceGuidelines({
    referenceGuidelines: params.referenceGuidelines,
  });

  if (!params.legalChunks || params.legalChunks.length === 0) {
    return withGuidelineCitations(EMPTY_LEGAL_AUDIT, referenceGuidelines);
  }

  const legalCorpusFormatted = params.legalChunks
    .map(
      (c) =>
        `[CHUNK_ID: ${c.chunkId}] | FONTE: ${c.title} | SEZ/ART: ${c.section || ""} ${c.article || ""} (${c.year || "N/A"})\nTESTO: ${c.text}`,
    )
    .join("\n---\n");

  const dischargeNote = params.simulationLog.clinicalSummary?.trim() ?? "";
  const guidelinesBlock = referenceGuidelines.map((line) => `- ${line}`).join("\n");
  const userPrompt = `
Compila comparativeAnalysis (almeno 4 righe se il log lo consente) con faultCategory e temporalRelevance, executiveSummary (2–3 frasi), cognitiveBiases (errori cognitivi rilevati, max 5), guidelineCitations e complianceScore partendo da 100 con le penalità CTU. Analizza l'ordine temporale del log.
Ai sensi dell'art. 5 della Legge 24/2017 (Gelli-Bianco), devi valutare se l'operato si discosta dalle raccomandazioni ufficiali. Se fornite, CITA SEMPRE le linee guida di riferimento nella tua analisi.
Se il medico ha compilato la 'Relazione di Dimissione' seguente, NON applicare la penalità per 'documentazione mancante' (-15 punti). Valuta invece se la relazione è coerente.
<<<LINEE_GUIDA_DI_RIFERIMENTO>>>
${guidelinesBlock}
<<<END_LINEE_GUIDA_DI_RIFERIMENTO>>>

<<<RELAZIONE_DI_DIMISSIONE>>>
${dischargeNote || "(non compilata)"}
<<<END_RELAZIONE_DI_DIMISSIONE>>>

<<<SIMULATION_LOG>>>
${JSON.stringify(params.simulationLog, null, 2)}
<<<END_SIMULATION_LOG>>>

<<<LEGAL_CORPUS>>>
${legalCorpusFormatted}
<<<END_LEGAL_CORPUS>>>
`;

  try {
    const { object } = await generateObject({
      model: openai("gpt-4o"),
      temperature: 0,
      system: LEGAL_AUDIT_SYSTEM_PROMPT,
      prompt: userPrompt,
      schema: LegalAuditResultSchema,
      abortSignal: AbortSignal.timeout(LEGAL_AUDIT_LLM_TIMEOUT_MS),
    });
    return withGuidelineCitations(
      enforceHarshLegalScore(object),
      referenceGuidelines,
    );
  } catch (error) {
    console.error("[legal-audit] LLM timeout/network/Zod — returning technical fallback", {
      error: error instanceof Error ? error.message : String(error),
    });
    return withGuidelineCitations(createLegalAuditTechnicalFallback(), referenceGuidelines);
  }
}
