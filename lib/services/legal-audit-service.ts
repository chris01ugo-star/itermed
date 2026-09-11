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
  comparativeAnalysis: z
    .array(LegalComparativeRowSchema)
    .min(1)
    .max(16)
    .describe("Confronto riga per riga: azione utente vs obbligo normativo."),
  uncoveredAreas: z.array(z.string().max(280)).max(8),
});

export type LegalFaultCategory = z.infer<typeof LegalFaultCategorySchema>;
export type LegalComparativeRow = z.infer<typeof LegalComparativeRowSchema>;
export type LegalAuditResult = z.infer<typeof LegalAuditResultSchema>;

export const LEGAL_AUDIT_SYSTEM_PROMPT = `
AGISCI COME UN PERITO MEDICO-LEGALE (CTU). Valuta l'operato incrociando la Legge Gelli-Bianco con il Codice Deontologico, la Legge 219/2017 e le Linee Guida cliniche presenti nel <<<LEGAL_CORPUS>>>.
CALCOLO DEL PUNTEGGIO (Parti da 100):
Omissione grave / Negligenza (es. mancato soccorso, diagnosi errata fatale): -40 a -60 punti.
Mancato consenso informato (L. 219/2017) prima di esami a rischio: -30 punti.
Imperizia / Medicina difensiva (esami inutili o non giustificati): -20 punti.
Difetto di documentazione (azione corretta ma non trascritta a referto): -15 punti.
Se l'utente fa azioni a caso o non fa nulla, il punteggio MASSIMO è 15.
Scrivi un executiveSummary di 2-3 righe che riassuma spietatamente il livello di tutela del medico.

REGOLE TASSATIVE:
1. ZERO ALLUCINAZIONI: Se <<<LEGAL_CORPUS>>> è vuoto o il caso non è coperto, imposta status NOT_EVALUABLE_NO_SOURCES e overallVerdict NOT_EVALUABLE. Non inventare giurisprudenza.
2. OUTPUT COMPARATIVO + SINTESI: Compila comparativeAnalysis (userAction, requiredAction, isProtected, explanation, sourceQuote, temporalRelevance, faultCategory) e executiveSummary (massimo 3 frasi). Niente elenchi confusi al posto della sintesi.
3. CITAZIONI PULITE: sourceQuote deve essere una citazione esatta e breve dal LEGAL_CORPUS. Se non puoi citarlo testualmente, lascia sourceQuote vuoto e isProtected = false.
4. DOCUMENTAZIONE: Se un'azione è corretta ma non è scritta in chat/referto, isProtected = false (in tribunale ciò che non è scritto non è stato fatto) e applica la penalità da 15 punti.
5. MEDICINA DIFENSIVA / AZIONI CASUALI: Esami o terapie non richieste dal corpus, o condotta disordinata senza percorso, sono isProtected = false.
6. SCORING A PENALITÀ:
   - Parti da 100 e sottrai le voci sopra. Non regalare punti per pietà.
   - overallVerdict FULLY_PROTECTED solo se quasi ogni riga è tutelata e il punteggio resta alto.
7. ANALISI CRONOLOGICA E TEMPESTIVITÀ: Esamina la sequenza temporale dei turni di chat e delle azioni. Se un intervento salvavita o un esame urgente viene eseguito con un ritardo ingiustificato rispetto agli standard clinici del <<<LEGAL_CORPUS>>>, qualificalo esplicitamente come 'RITARDO DIAGNOSTICO/TERAPEUTICO' e applica una pesante penalità temporale. Compila temporalRelevance su ogni riga rilevante.
8. QUALIFICAZIONE DELLA COLPA (Art. 5 e 6 L. 24/2017): Distingui nettamente tra Imperizia Lieve (scostamento veniale da linee guida in casi complessi, protetto dall'Art. 5 se si seguono buone pratiche) e Negligenza Grave / Imperizia Grossolana (azioni casuali, omissioni di protocolli di base, farmaci controindicati in anamnesi). La colpa grave azzera la tutela e fa crollare il punteggio a 0-10. Imposta faultCategory: OTTIMALE | IMPERIZIA_LIEVE | NEGLIGENZA_GRAVE | DIFETTO_CONSENSO. NEGLIGENZA_GRAVE ⇒ isProtected = false.
9. PROFONDITÀ DEL CONSENSO (Legge 219/2017): Non verificare solo se è stato 'ottenuto' un consenso generico, ma se l'utente ha informato il paziente sui rischi specifici prima di procedure invasive. Consenso generico o assente ⇒ faultCategory DIFETTO_CONSENSO e isProtected = false.
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

export async function runLegalAudit(params: {
  simulationLog: {
    chatHistory: any[];
    requestedExams: any[];
    finalDiagnosis?: string;
  };
  legalChunks: Array<{
    chunkId: string;
    title: string;
    section?: string;
    article?: string;
    year?: number;
    text: string;
  }>;
}): Promise<LegalAuditResult> {
  if (!params.legalChunks || params.legalChunks.length === 0) {
    return EMPTY_LEGAL_AUDIT;
  }

  const legalCorpusFormatted = params.legalChunks
    .map(
      (c) =>
        `[CHUNK_ID: ${c.chunkId}] | FONTE: ${c.title} | SEZ/ART: ${c.section || ""} ${c.article || ""} (${c.year || "N/A"})\nTESTO: ${c.text}`,
    )
    .join("\n---\n");

  const userPrompt = `
Compila comparativeAnalysis (almeno 4 righe se il log lo consente) con faultCategory e temporalRelevance, executiveSummary (2–3 frasi) e complianceScore partendo da 100 con le penalità CTU. Analizza l'ordine temporale del log.

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
    return enforceHarshLegalScore(object);
  } catch (error) {
    console.error("[legal-audit] LLM timeout/network/Zod — returning technical fallback", {
      error: error instanceof Error ? error.message : String(error),
    });
    return createLegalAuditTechnicalFallback();
  }
}
