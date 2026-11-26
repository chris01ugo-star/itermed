import { z } from "zod";
import { generateObject } from "ai";
import { MODEL_GPT_61_SOL, openAIObjectCall } from "@/lib/ai/models";
import { asOpenAIStrictSchema } from "@/lib/ai/strict-schema";
import { formatAuditChatTranscript } from "@/lib/services/audit-chat-transcript";

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
export type LegalSourceBasis =
  | "RAG_SPECIALISTICO_E_NORMATIVA_NAZIONALE"
  | "NORMATIVA_NAZIONALE_BASELINE";

export type LegalAuditResult = z.infer<typeof LegalAuditResultSchema> & {
  sourceBasis?: LegalSourceBasis;
};

export const LEGAL_AUDIT_SYSTEM_PROMPT = `
AGISCI COME UN PERITO MEDICO-LEGALE (CTU) SPIETATO E INTRANSIGENTE. Valuta l'operato incrociando la Legge Gelli-Bianco, il Codice Deontologico, la Legge 219/2017 e le Linee Guida EBM (Evidence Based Medicine) presenti nel <<<LEGAL_CORPUS>>>.

SEI UN COMMISSARIO D'ESAME MEDICO SEVERO E IMPARZIALE. Non devi mai cercare di 'salvare' o incoraggiare lo studente. Se c'è un'omissione anamnestica, una diagnosi errata, o una violazione delle linee guida, DEVI applicare la massima severità analitica. Non dedurre competenze non dimostrate nel CHAT_TRANSCRIPT.

GRAVITÀ CLINICA: l'omissione di parametri vitali, allergie o red flag neurologiche non è una svista. È un Errore Critico. Una violazione grave della Legge Gelli-Bianco o del consenso informato non si compensa con cortesia o risparmio economico: il complianceScore deve riflettere la massima severità.
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
3-bis. TEST HIV (Legge 135/1990): se nel log compare un test HIV (hiv-ag-ab, hiv-hcv-hbv o sinonimi) senza consenso esplicito al test (consenso-hiv, oppure informed_consent con menzione dell'HIV), faultCategory DIFETTO_CONSENSO, isProtected = false, sottrai 40 punti. Il consenso generico a un prelievo non basta.
4. FATTORI UMANI E BIAS COGNITIVI: Analizza l'intero transcript per identificare errori cognitivi ('Chiusura Prematura', 'Ancoraggio'). Compila il campo 'cognitiveBiases' elencando spietatamente questi errori.
5. ANALISI CRONOLOGICA E TEMPESTIVITÀ (GOLDEN HOUR): Il tempo è un parametro forense. Se un'azione salvavita o un esame urgente avviene in ritardo, inserisci 'RITARDO DIAGNOSTICO/TERAPEUTICO INACCETTABILE' in temporalRelevance.
6. DOCUMENTAZIONE: Ciò che non è scritto non è stato fatto. Il referto ha cinque componenti nel blocco <<<REFERTO_CLINICO>>>: anamnesi ed esame obiettivo, riscontri e ragionamento, diagnosi e terapia, informazione/consenso/follow-up/red flags, chiusura formale. Penalizza in modo granulare e motivato ogni omissione: referto vuoto massimo 20; manca anamnesi o allergie −15; mancano riscontri −10; manca diagnosi o condotta −15; mancano red flags o informazione al paziente −15; manca il consenso/presa d'atto −15; manca la chiusura con data/qualifica −5. Se la Relazione di Dimissione è assente, applica -15 punti per documentazione mancante e isProtected = false sulle azioni non trascritte. Se il medico ha compilato la Relazione di Dimissione nel blocco <<<RELAZIONE_DI_DIMISSIONE>>>, NON applicare la penalità per documentazione mancante (-15 punti). Valuta invece se la relazione è coerente con diagnosi, esami e terapia: una relazione presente ma incoerente è un difetto di contenuto, non di assenza.
7. FONTI: Il corpus include sempre la normativa nazionale di base (L. 24/2017, L. 219/2017, art. 476–479 c.p.), anche se i chunk RAG di specialità sono zero. In quel caso status resta EVALUATED. NOT_EVALUABLE_NO_SOURCES è riservato al solo fallimento tecnico, non all'assenza di chunk di specialità.
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
  "malattie-infettive": [
    "Linee guida IDSA/ESCMID, Ministero della Salute e SNLG-ISS per la patologia infettiva del caso",
    "Legge 135/1990 sul consenso al test HIV",
  ],
  oncologia: [
    "Linee guida AIOM ed ESMO per la patologia oncologica del caso",
    "Legge 219/2017 sul consenso e sulle cure palliative",
  ],
  reumatologia: [
    "Linee guida EULAR/SIR e SNLG-ISS per la patologia reumatologica del caso",
  ],
  geriatria: [
    "Criteri di Beers, SIGG e SNLG-ISS per la valutazione multidimensionale geriatrica",
    "Legge 219/2017 su consenso, DAT e pianificazione condivisa delle cure",
    "Note AIFA 85 e 96 su antidemenza e vitamina D",
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

export type LegalCorpusChunk = {
  chunkId: string;
  title: string;
  section?: string;
  article?: string;
  year?: number;
  text: string;
};

/** Normativa nazionale sempre disponibile, anche con zero chunk RAG di specialità. */
export const NATIONAL_LEGAL_BASELINE: LegalCorpusChunk[] = [
  {
    chunkId: "baseline-l-24-2017",
    title: "Legge 24/2017 (Gelli-Bianco)",
    section: "art. 5-7",
    article: "5",
    year: 2017,
    text: "Art. 5: gli esercenti le professioni sanitarie si attengono, salve le specificità del caso, alle raccomandazioni previste dalle linee guida pubblicate ed elaborate da enti e istituzioni pubblici e privati e dalle società scientifiche. Art. 6: la sicurezza delle cure è parte costitutiva del diritto alla salute. Art. 7: la responsabilità della struttura e dell'esercente si valuta anche sulla completezza della documentazione clinica.",
  },
  {
    chunkId: "baseline-l-219-2017",
    title: "Legge 219/2017",
    section: "consenso informato",
    article: "1",
    year: 2017,
    text: "Nessun trattamento sanitario può essere iniziato o proseguito se privo del consenso libero e informato della persona, tranne i casi previsti dalla legge. Il tempo della comunicazione è tempo di cura. L'informazione riguarda diagnosi, prognosi, benefici e rischi delle alternative, e la possibilità di rifiutare. Vanno documentate l'informazione, la presa d'atto e le disposizioni anticipate quando presenti.",
  },
  {
    chunkId: "baseline-cp-476-479",
    title: "Codice penale, art. 476-479",
    section: "documentazione clinica",
    article: "476",
    text: "La cartella e il referto sono atti con valore probatorio. Requisiti minimi: completezza, veridicità, tracciabilità temporale, anamnesi con allergie e terapia in atto, riscontri e ragionamento, diagnosi e condotta, follow-up e red flags, informazione al paziente, chiusura con data, ora e qualifica di chi scrive. L'omissione non si presume compiuta.",
  },
];

export function legalSourceBasis(ragChunkCount: number): LegalSourceBasis {
  return ragChunkCount > 0
    ? "RAG_SPECIALISTICO_E_NORMATIVA_NAZIONALE"
    : "NORMATIVA_NAZIONALE_BASELINE";
}

export function assembleLegalCorpus(params: {
  legalChunks?: LegalCorpusChunk[] | null;
  referenceGuidelines?: readonly string[] | null;
  caseNotes?: string | null;
}): { chunks: LegalCorpusChunk[]; sourceBasis: LegalSourceBasis } {
  const rag = (params.legalChunks ?? []).filter((chunk) => chunk.text?.trim() && chunk.chunkId);
  const notes = params.caseNotes?.trim() ?? "";
  const guidelineText = (params.referenceGuidelines ?? []).filter((line) => line.trim()).join("\n");
  const extra: LegalCorpusChunk[] = [];
  if (guidelineText) {
    extra.push({
      chunkId: "baseline-linee-guida-caso",
      title: "Linee guida di riferimento del caso",
      section: "art. 5 L. 24/2017",
      text: guidelineText,
    });
  }
  if (notes) {
    extra.push({
      chunkId: "baseline-metadati-caso",
      title: "Metadati medico-legali del caso",
      section: "scudo Gelli-Bianco e citazioni autorate",
      text: notes,
    });
  }
  return {
    chunks: [...NATIONAL_LEGAL_BASELINE, ...extra, ...rag],
    sourceBasis: legalSourceBasis(rag.length),
  };
}

export function buildLegalAuditUserPrompt(params: {
  simulationLog: {
    chatHistory: unknown[];
    requestedExams: unknown[];
    finalDiagnosis?: string;
    performedActions?: LegalPerformedAction[];
    clinicalSummary?: string;
    reportText?: string;
  };
  corpus: LegalCorpusChunk[];
  referenceGuidelines: readonly string[];
  sourceBasis: LegalSourceBasis;
}): string {
  const legalCorpusFormatted = params.corpus
    .map(
      (c) =>
        `[CHUNK_ID: ${c.chunkId}] | FONTE: ${c.title} | SEZ/ART: ${c.section || ""} ${c.article || ""} (${c.year || "N/A"})\nTESTO: ${c.text}`,
    )
    .join("\n---\n");
  const dischargeNote = params.simulationLog.clinicalSummary?.trim() ?? "";
  const reportText = params.simulationLog.reportText?.trim() ?? "";
  const chatTranscript = formatAuditChatTranscript(
    params.simulationLog.chatHistory as Array<{ role?: string | null; content?: string | null }>,
  );
  const guidelinesBlock = params.referenceGuidelines.map((line) => `- ${line}`).join("\n");
  const basisLabel =
    params.sourceBasis === "RAG_SPECIALISTICO_E_NORMATIVA_NAZIONALE"
      ? "RAG specialistico + normativa nazionale"
      : "Normativa nazionale baseline + linee guida di riferimento";
  return `
Compila comparativeAnalysis (almeno 4 righe se il log lo consente) con faultCategory e temporalRelevance, executiveSummary (2–3 frasi), cognitiveBiases (errori cognitivi rilevati, max 5), guidelineCitations e complianceScore partendo da 100 con le penalità CTU. Analizza l'ordine temporale del log e TUTTE le sezioni del referto, non solo il diario.
Ai sensi dell'art. 5 della Legge 24/2017 (Gelli-Bianco), devi valutare se l'operato si discosta dalle raccomandazioni ufficiali. Se fornite, CITA SEMPRE le linee guida di riferimento nella tua analisi.
Se il medico ha compilato la 'Relazione di Dimissione' seguente, NON applicare la penalità per 'documentazione mancante' (-15 punti). Valuta invece se la relazione è coerente.
BASE_FONTI: ${basisLabel}
<<<LINEE_GUIDA_DI_RIFERIMENTO>>>
${guidelinesBlock}
<<<END_LINEE_GUIDA_DI_RIFERIMENTO>>>

<<<REFERTO_CLINICO>>>
${reportText || "(referto non compilato)"}
<<<END_REFERTO_CLINICO>>>

<<<RELAZIONE_DI_DIMISSIONE>>>
${dischargeNote || "(non compilata)"}
<<<END_RELAZIONE_DI_DIMISSIONE>>>

<<<CHAT_HISTORY>>>
${chatTranscript}
<<<END_CHAT_HISTORY>>>

<<<REQUESTED_EXAMS>>>
${JSON.stringify(params.simulationLog.requestedExams ?? [])}
<<<END_REQUESTED_EXAMS>>>

<<<PERFORMED_ACTIONS>>>
${JSON.stringify(params.simulationLog.performedActions ?? [])}
<<<END_PERFORMED_ACTIONS>>>

<<<FINAL_DIAGNOSIS>>>
${params.simulationLog.finalDiagnosis ?? ""}
<<<END_FINAL_DIAGNOSIS>>>

<<<LEGAL_CORPUS>>>
${legalCorpusFormatted}
<<<END_LEGAL_CORPUS>>>
`;
}

export type LegalAuditGenerate = (input: { system: string; prompt: string }) => Promise<LegalAuditResult>;

async function defaultLegalAuditGenerate(input: { system: string; prompt: string }): Promise<LegalAuditResult> {
  const { object } = await generateObject({
    ...openAIObjectCall(MODEL_GPT_61_SOL),
    maxRetries: 0,
    system: input.system,
    prompt: input.prompt,
    schema: asOpenAIStrictSchema(LegalAuditResultSchema),
    abortSignal: AbortSignal.timeout(LEGAL_AUDIT_LLM_TIMEOUT_MS),
  });
  return object;
}

type LegalAuditFailureReason = "timeout" | "openai_error" | "json_parse" | "zod_validation";

function errorChain(error: unknown): unknown[] {
  const chain: unknown[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current; depth += 1) {
    chain.push(current);
    if (typeof current !== "object") break;
    current = (current as { cause?: unknown }).cause;
  }
  return chain;
}

function readStatusCode(error: unknown): number | undefined {
  for (const item of errorChain(error)) {
    if (!item || typeof item !== "object") continue;
    const record = item as { statusCode?: unknown; status?: unknown };
    if (typeof record.statusCode === "number") return record.statusCode;
    if (typeof record.status === "number") return record.status;
  }
  return undefined;
}

function readZodIssues(error: unknown): unknown {
  for (const item of errorChain(error)) {
    if (!item || typeof item !== "object" || !("issues" in item)) continue;
    const issues = (item as { issues?: unknown }).issues;
    if (Array.isArray(issues)) return issues;
  }
  return undefined;
}

function classifyLegalAuditFailure(error: unknown): {
  reason: LegalAuditFailureReason;
  detail: string;
  retryable: boolean;
} {
  const chain = errorChain(error);
  const message = chain
    .map((item) => (item instanceof Error ? `${item.name}: ${item.message}` : ""))
    .filter(Boolean)
    .join(" | ");
  const blob = message.toLowerCase();
  const issues = readZodIssues(error);
  const rawText = chain
    .map((item) =>
      item && typeof item === "object" && typeof (item as { text?: unknown }).text === "string"
        ? (item as { text: string }).text
        : "",
    )
    .find(Boolean);

  if (
    blob.includes("timeout") ||
    blob.includes("aborted") ||
    blob.includes("abort") ||
    chain.some((item) => item instanceof Error && item.name === "TimeoutError")
  ) {
    return { reason: "timeout", detail: message.slice(0, 800), retryable: false };
  }
  if (issues || blob.includes("zod")) {
    const issueText = issues ? JSON.stringify(issues).slice(0, 700) : "";
    return {
      reason: "zod_validation",
      detail: `${message} ${issueText}`.trim().slice(0, 800),
      retryable: true,
    };
  }
  if (blob.includes("json") || blob.includes("could not parse") || blob.includes("no object generated")) {
    return {
      reason: "json_parse",
      detail: `${message} ${rawText ?? ""}`.trim().slice(0, 800),
      retryable: true,
    };
  }
  const status = readStatusCode(error);
  const retryable =
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    blob.includes("fetch failed") ||
    blob.includes("econnreset") ||
    blob.includes("socket hang up") ||
    blob.includes("network");
  return { reason: "openai_error", detail: message.slice(0, 800), retryable };
}

export function summarizeLegalCoaching(result: LegalAuditResult): string {
  const findings = (result.comparativeAnalysis ?? [])
    .slice(0, 3)
    .map((row) => row.explanation.trim())
    .filter(Boolean);
  const basis =
    result.sourceBasis === "RAG_SPECIALISTICO_E_NORMATIVA_NAZIONALE"
      ? "Fonti: RAG specialistico e normativa nazionale."
      : result.sourceBasis === "NORMATIVA_NAZIONALE_BASELINE"
        ? "Fonti: normativa nazionale di base e linee guida di riferimento."
        : "";
  return [result.executiveSummary.trim(), ...findings, basis].filter(Boolean).join(" ").slice(0, 600);
}

export async function runLegalAudit(
  params: {
    simulationLog: {
      chatHistory: any[];
      requestedExams: any[];
      finalDiagnosis?: string;
      performedActions?: LegalPerformedAction[];
      clinicalSummary?: string;
      reportText?: string;
    };
    legalChunks: LegalCorpusChunk[];
    /** Linee guida del caso (SNLG, ISS, ESC, AHA, …) da citare ai sensi dell'art. 5. */
    referenceGuidelines?: string[];
    /** Scudo Gelli-Bianco e citazioni autorate del caso. */
    caseNotes?: string | null;
  },
  options?: { generate?: LegalAuditGenerate },
): Promise<LegalAuditResult> {
  const referenceGuidelines = resolveReferenceGuidelines({
    referenceGuidelines: params.referenceGuidelines,
  });
  const assembled = assembleLegalCorpus({
    legalChunks: params.legalChunks,
    referenceGuidelines,
    caseNotes: params.caseNotes,
  });
  const userPrompt = buildLegalAuditUserPrompt({
    simulationLog: params.simulationLog,
    corpus: assembled.chunks,
    referenceGuidelines,
    sourceBasis: assembled.sourceBasis,
  });

  const generate = options?.generate ?? defaultLegalAuditGenerate;
  let lastFailure: ReturnType<typeof classifyLegalAuditFailure> | null = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const object = await generate({ system: LEGAL_AUDIT_SYSTEM_PROMPT, prompt: userPrompt });
      const scored = enforceHarshLegalScore({ ...object, status: "EVALUATED" });
      return {
        ...withGuidelineCitations(scored, referenceGuidelines),
        sourceBasis: assembled.sourceBasis,
      };
    } catch (error) {
      lastFailure = classifyLegalAuditFailure(error);
      console.error("[legal-audit] perizia non completata", {
        reason: lastFailure.reason,
        attempt,
        retrying: attempt === 1 && lastFailure.retryable,
        detail: lastFailure.detail,
      });
      if (attempt === 1 && lastFailure.retryable) continue;
      break;
    }
  }

  const fallback = createLegalAuditTechnicalFallback();
  return {
    ...withGuidelineCitations(fallback, referenceGuidelines),
    complianceScore: Math.min(fallback.complianceScore, 0),
    sourceBasis: assembled.sourceBasis,
  };
}
