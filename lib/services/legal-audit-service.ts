import { z } from "zod";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";

export const LegalAuditResultSchema = z.object({
  status: z.enum(["EVALUATED", "NOT_EVALUABLE_NO_SOURCES"]),
  overallVerdict: z.enum([
    "FULLY_PROTECTED",
    "PARTIALLY_PROTECTED",
    "LEGAL_RISK_EXPOSED",
    "NOT_EVALUABLE",
  ]),
  complianceScore: z.number().min(0).max(100),
  compliantActions: z.array(
    z.object({
      performedAction: z.string(),
      supportingGuidelineRef: z.string(),
      chunkId: z.string(),
    }),
  ),
  legalOmissionsOrRisks: z.array(
    z.object({
      missedOrErroneousAction: z.string(),
      legalRiskDescription: z.string(),
      violatedGuidelineRef: z.string(),
      chunkId: z.string(),
    }),
  ),
  uncoveredAreas: z.array(z.string()),
});

export type LegalAuditResult = z.infer<typeof LegalAuditResultSchema>;

export const LEGAL_AUDIT_SYSTEM_PROMPT = `
SEI UN AUDITOR MEDICO-LEGALE SPECIALIZZATO NELLA VALUTAZIONE DELLA RESPONSABILITÀ PROFESSIONALE (LEGGE 24/2017 GELLI-BIANCO).
IL TUO COMPITO È ANALIZZARE L'OPERATO DEL MEDICO NELLA SIMULAZIONE CONFRONTANDOLO ESCLUSIVAMENTE CON IL CONTESTO NORMATIVO E LE LINEE GUIDA FORNITE IN <<<LEGAL_CORPUS>>>.
REGOLE TASSATIVE:
1. SE <<<LEGAL_CORPUS>>> È VUOTO O PRIVO DI CHUNK CON SIMILARITÀ VALIDA, IMPOSTA STATUS="NOT_EVALUABLE_NO_SOURCES", OVERALLVERDICT="NOT_EVALUABLE", COMPLIANCESCORE=0 E NON ESPRIMERE ALCUN GIUDIZIO.
2. NON INVENTARE O PRESUMERE NORME, ARTICOLI O LINEE GUIDA NON PRESENTI IN <<<LEGAL_CORPUS>>>.
3. PER OGNI AZIONE GIUDICATA CONFORME O A RISCHIO, DEVI INDICARE OBBLIGATORIAMENTE IL CHUNK_ID ORIGINALE E LA CITAZIONE TESTUALE DEL DOCUMENTO.
4. OGNI FATTISPECIE CLINICA O SCELTA NON COPERTA DAI DOCUMENTI INVIATI DEVE ESSERE INSERITA NELL'ARRAY 'uncoveredAreas' SENZA ESPRIMERE GIUDIZI DI COLPA O RISCHIO.
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
