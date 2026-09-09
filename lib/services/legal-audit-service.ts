import { z } from "zod";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";

export const LegalAuditResultSchema = z.object({
  status: z.enum(["EVALUATED", "NOT_EVALUABLE_NO_SOURCES"]),
  overallVerdict: z.enum(["FULLY_PROTECTED", "PARTIALLY_PROTECTED", "LEGAL_RISK_EXPOSED", "DEFENSIVE_MEDICINE_DETECTED", "NOT_EVALUABLE"]),
  complianceScore: z.number().min(0).max(100),
  compliantActions: z.array(z.object({
    performedAction: z.string(),
    supportingGuidelineRef: z.string(),
    chunkId: z.string()
  })),
  legalOmissionsOrRisks: z.array(z.object({
    missedOrErroneousAction: z.string(),
    riskCategory: z.enum(["OMISSIONE_SOCCORSO", "IMPERIZIA", "DIFETTO_DOCUMENTAZIONE", "MEDICINA_DIFENSIVA"]),
    legalRiskDescription: z.string(),
    educationalTakeaway: z.string().describe("Spiegazione didattica su come prevenire questo rischio in guardia medica"),
    violatedGuidelineRef: z.string(),
    exactQuote: z.string().describe("Citazione testuale esatta dal LEGAL_CORPUS"),
    chunkId: z.string()
  })),
  uncoveredAreas: z.array(z.string()),
});

export type LegalAuditResult = z.infer<typeof LegalAuditResultSchema>;

export const LEGAL_AUDIT_SYSTEM_PROMPT = `
SEI UN MENTORE MEDICO-LEGALE SPIETATO E INFLESSIBILE (LEGGE 24/2017 GELLI-BIANCO).
IL TUO COMPITO È COSTRUIRE LA FORMA MENTIS DELLO STUDENTE, CONFRONTANDO L'OPERATO ESCLUSIVAMENTE CON <<<LEGAL_CORPUS>>>.
REGOLE TASSATIVE DI SOPRAVVIVENZA LEGALE:
1. ZERO ALLUCINAZIONI: Se <<<LEGAL_CORPUS>>> è vuoto o il caso non è coperto, imposta NOT_EVALUABLE_NO_SOURCES. Non inventare giurisprudenza.
2. CITAZIONI ESATTE: Ogni rischio segnalato in 'legalOmissionsOrRisks' DEVE includere 'exactQuote' con le parole esatte del documento e il 'chunkId'. Se non puoi citarlo testualmente, non è un errore legale.
3. IL TRAPPOLONE DELLA DOCUMENTAZIONE: Se lo studente compie un'azione corretta ma nel referto o nella chat manca la giustificazione clinica esplicita, segnalalo come "DIFETTO_DOCUMENTAZIONE". In tribunale, ciò che non è scritto non è stato fatto.
4. MEDICINA DIFENSIVA: Cerca esami o terapie prescritte non richieste dal protocollo in <<<LEGAL_CORPUS>>>. Segnalali come "MEDICINA_DIFENSIVA". Spiega in 'educationalTakeaway' che gli esami inutili espongono a colpa per imperizia.
5. AZIONE FORMATIVA: In 'educationalTakeaway', usa un tono asciutto e diretto per spiegare come la Legge Gelli-Bianco valuterà questa specifica deviazione.
`;

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
    return {
      status: "NOT_EVALUABLE_NO_SOURCES",
      overallVerdict: "NOT_EVALUABLE",
      complianceScore: 0,
      compliantActions: [],
      legalOmissionsOrRisks: [],
      uncoveredAreas: [
        "Nessun documento di tutela legale o linea guida accreditata reperito per questa specialità/caso.",
      ],
    };
  }

  const legalCorpusFormatted = params.legalChunks
    .map(
      (c) =>
        `[CHUNK_ID: ${c.chunkId}] | FONTE: ${c.title} | SEZ/ART: ${c.section || ""} ${c.article || ""} (${c.year || "N/A"})\nTESTO: ${c.text}`,
    )
    .join("\n---\n");

  const userPrompt = `
<<<SIMULATION_LOG>>>
${JSON.stringify(params.simulationLog, null, 2)}
<<<END_SIMULATION_LOG>>>

<<<LEGAL_CORPUS>>>
${legalCorpusFormatted}
<<<END_LEGAL_CORPUS>>>
`;

  const { object } = await generateObject({
    model: openai("gpt-4o"),
    temperature: 0,
    system: LEGAL_AUDIT_SYSTEM_PROMPT,
    prompt: userPrompt,
    schema: LegalAuditResultSchema,
  });

  return object;
}
