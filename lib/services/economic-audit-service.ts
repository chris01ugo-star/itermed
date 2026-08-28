import { z } from "zod";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";

export const EconomicAuditResultSchema = z.object({
  status: z.enum(["EVALUATED", "NOT_EVALUABLE"]),
  overallVerdict: z.enum([
    "OPTIMAL_EFFICIENCY",
    "MODERATE_OVERTESTING",
    "SEVERE_OVERTESTING",
    "CRITICAL_UNDERTESTING",
  ]),
  efficiencyScore: z.number().min(0).max(100),
  financialSummary: z.object({
    totalSpentEuro: z.number(),
    idealCostEuro: z.number(),
    deltaEuro: z.number(),
    inappropriateSpendEuro: z.number(),
  }),
  inappropriateExams: z.array(
    z.object({
      examId: z.string(),
      examName: z.string(),
      costEuro: z.number(),
      reasonForInappropriateness: z.string(),
    }),
  ),
  omittedEssentialExams: z.array(
    z.object({
      examId: z.string(),
      examName: z.string(),
      costEuro: z.number(),
      clinicalImpactOfOmission: z.string(),
    }),
  ),
  appropriateExamsCount: z.number(),
});

export type EconomicAuditResult = z.infer<typeof EconomicAuditResultSchema>;

export const ECONOMIC_AUDIT_SYSTEM_PROMPT = `
SEI UN AUDITOR DI APPROPRIATEZZA PRESCRITTIVA E GOVERNANCE ECONOMICA SANITARIA (SSN).
IL TUO COMPITO È VALUTARE LA GIUSTIFICAZIONE CLINICA DEGLI ESAMI RICHIESTI DAL MEDICO RISPETTO AL PERCORSO DIAGNOSTICO IDEALE (GOLD PATH) E AI TARIFFARI/LINEE GUIDA FORNITE IN <<<ECONOMIC_CORPUS>>>.
REGOLE TASSATIVE:
1. NON INVENTARE TARIFFE O COSTI: USA ESCLUSIVAMENTE I VALORI IN EURO GIÀ PRESENTI NEL CONTESTO FORNITO.
2. SE UN ESAMEN NON È PRESENTE NEL GOLD PATH MA È CLINICAMENTE GIUSTIFICATO DAI SINTOMI DEL PAZIENTE, NON CLASSIFICARLO COME INAPPROPRIATO.
3. CLASSIFICA COME 'inappropriateExams' SOLO GLI ESAMI RIDONDANTI, PRECOCI O PRIVI DI QUALSIASI INDICAZIONE CLINICA.
4. CLASSIFICA COME 'omittedEssentialExams' GLI ESAMI FONDAMENTALI DEL GOLD PATH CHE IL MEDICO NON HA PRESCRITTO.
5. OGNI GIUDIZIO DI INAPPROPRIETÀ O OMISSIONE DEVE ESSERE MOTIVATO IN MODO SINTETICO E RIGOROSO.
`;

export async function runEconomicAudit(params: {
  requestedExams: Array<{
    id: string;
    name: string;
    costEuro: number;
    isGoldPath: boolean;
  }>;
  goldPathExams: Array<{
    id: string;
    name: string;
    costEuro: number;
  }>;
  clinicalContext: string;
  economicGuidelineChunks?: Array<{
    title: string;
    text: string;
  }>;
}): Promise<EconomicAuditResult> {
  const { requestedExams, goldPathExams, clinicalContext, economicGuidelineChunks } = params;

  // 1. Calcolo Deterministico Matematico Server-Side
  const totalSpentEuro = requestedExams.reduce((acc, e) => acc + (e.costEuro || 0), 0);
  const idealCostEuro = goldPathExams.reduce((acc, e) => acc + (e.costEuro || 0), 0);
  const deltaEuro = Number((totalSpentEuro - idealCostEuro).toFixed(2));

  if (!requestedExams || requestedExams.length === 0) {
    return {
      status: "EVALUATED",
      overallVerdict: "CRITICAL_UNDERTESTING",
      efficiencyScore: 0,
      financialSummary: {
        totalSpentEuro: 0,
        idealCostEuro,
        deltaEuro: Number((-idealCostEuro).toFixed(2)),
        inappropriateSpendEuro: 0,
      },
      inappropriateExams: [],
      omittedEssentialExams: goldPathExams.map((g) => ({
        examId: g.id,
        examName: g.name,
        costEuro: g.costEuro,
        clinicalImpactOfOmission: "Omissione totale del protocollo diagnostico standard.",
      })),
      appropriateExamsCount: 0,
    };
  }

  const economicCorpus = (economicGuidelineChunks || [])
    .map((c) => `[FONTE: ${c.title}]\n${c.text}`)
    .join("\n---\n");

  const userPrompt = `
<<<CLINICAL_CONTEXT>>>
${clinicalContext}
<<<END_CLINICAL_CONTEXT>>>

<<<REQUESTED_EXAMS>>>
${JSON.stringify(requestedExams, null, 2)}
<<<END_REQUESTED_EXAMS>>>

<<<GOLD_PATH_EXAMS>>>
${JSON.stringify(goldPathExams, null, 2)}
<<<END_GOLD_PATH_EXAMS>>>

<<<ECONOMIC_CORPUS>>>
${economicCorpus || "Nessuna linea guida specifica fornita. Valuta sulla base del Gold Path."}
<<<END_ECONOMIC_CORPUS>>>
`;

  const { object } = await generateObject({
    model: openai("gpt-4o"),
    temperature: 0,
    system: ECONOMIC_AUDIT_SYSTEM_PROMPT,
    prompt: userPrompt,
    schema: EconomicAuditResultSchema,
  });

  // Enforce server-side euro totals and rebind SSN tariffs (no LLM zero/hallucination).
  const goldCostById = new Map(goldPathExams.map((g) => [g.id, g.costEuro] as const));
  const requestedCostById = new Map(requestedExams.map((e) => [e.id, e.costEuro] as const));

  const pickTariff = (examId: string, llmCost: number, prefer: "gold" | "requested") => {
    if (Number.isFinite(llmCost) && llmCost > 0) return llmCost;
    if (prefer === "gold") {
      return goldCostById.get(examId) ?? requestedCostById.get(examId) ?? 0;
    }
    return requestedCostById.get(examId) ?? goldCostById.get(examId) ?? 0;
  };

  const inappropriateExams = object.inappropriateExams.map((e) => ({
    ...e,
    costEuro: pickTariff(e.examId, Number(e.costEuro) || 0, "requested"),
  }));

  const omittedEssentialExams = object.omittedEssentialExams.map((o) => ({
    ...o,
    costEuro: pickTariff(o.examId, Number(o.costEuro) || 0, "gold"),
  }));

  const inappropriateSpendEuro = Number(
    inappropriateExams
      .reduce((acc, e) => acc + (Number(e.costEuro) || 0), 0)
      .toFixed(2),
  );

  return {
    ...object,
    inappropriateExams,
    omittedEssentialExams,
    financialSummary: {
      totalSpentEuro: Number(totalSpentEuro.toFixed(2)),
      idealCostEuro: Number(idealCostEuro.toFixed(2)),
      deltaEuro,
      inappropriateSpendEuro,
    },
  };
}
