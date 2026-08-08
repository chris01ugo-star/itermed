import { z } from "zod";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";

export const RelationalAuditResultSchema = z.object({
  status: z.enum(["EVALUATED", "NOT_EVALUABLE"]),
  overallVerdict: z.enum([
    "EXCELLENT_RELATIONAL_CARE",
    "SATISFACTORY_RELATIONAL_CARE",
    "MECHANICAL_TRANSACTIONAL",
    "RELATIONAL_FAIL_OR_IATROGENIC_DISTRESS",
  ]),
  careEmpathyScore: z.number().min(0).max(100),
  riasMetrics: z.object({
    empathyValidationCount: z.number(),
    jargonWithoutExplanationCount: z.number(),
    activeListeningScore: z.number().min(0).max(100),
    sharedDecisionMakingScore: z.number().min(0).max(100),
  }),
  careMeasureChecklist: z.array(
    z.object({
      dimension: z.string(),
      observed: z.boolean(),
      evidenceUtterance: z.string().optional(),
      clinicalImpactNote: z.string(),
    }),
  ),
  criticalRelationalFlaws: z.array(
    z.object({
      doctorUtteranceOrOmission: z.string(),
      psychologicalImpact: z.string(),
      riasViolationType: z.string(),
      suggestedEvidenceBasedAlternative: z.string(),
    }),
  ),
  spikesProtocolCompliance: z.object({
    isApplicable: z.boolean(),
    adherenceScorePercentage: z.number().min(0).max(100),
    missedSteps: z.array(z.string()),
  }),
});

export type RelationalAuditResult = z.infer<typeof RelationalAuditResultSchema>;

export const RELATIONAL_AUDIT_SYSTEM_PROMPT = `
SEI UN AUDITOR IN PSICOLOGIA CLINICA E COMUNICAZIONE SANITARIA, ESPERTO NELL'APPLICAZIONE DEI FRAMEWORK RIAS (ROTER INTERACTION ANALYSIS SYSTEM), CARE MEASURE E PROTOCOLLO SPIKES.
IL TUO COMPITO È ANALIZZARE RIGOROSAMENTE LA CHAT TRA IL MEDICO E IL PAZIENTE IN <<<CHAT_HISTORY>>>. NON GIUDICARE LA GENTILEZZA ASTRATTA, MA APPLICA GLI INDICATORI PSICOMETRICI STANDARD.
REGOLE TASSATIVE DI AUDIT:
1. VALUTA UNICAMENTE LE EVVIDENZE TESTUALI DEL MEDICO PRESENTE NELLA CHAT.
2. RIAS ANALYSIS: CONTA LE ESPRESSIONI DI LEGITTIMAZIONE EMOTIVA, L'USO DI GERGO MEDICO NON SPIEGATO E IL GRADO DI CO-DECISIONE.
3. CARE MEASURE: VERIFICA SE IL MEDICO HA DATO SPAZIO ALLE PAURE DEL PAZIENTE O SE È STATO UN MERO ESECUTORE TRANSAZIONALE.
4. SE IL MEDICO HA IGNORATO SEGNALI DI DISTRESS EMOTIVO DEL PAZIENTE O HA MOSTRATO UN ATTEGGIAMENTO SBRIGATIVO/DIRETTIVO SENZA EMPATIA, CLASSIFICA OVERALLVERDICT="MECHANICAL_TRANSACTIONAL".
5. SE HA USATO TONI SVALUTANTI, OFFENSIVI O CATTIVE NOTIZIE SENZA PREPARAZIONE, CLASSIFICA OVERALLVERDICT="RELATIONAL_FAIL_OR_IATROGENIC_DISTRESS".
`;

export async function runRelationalAudit(params: {
  chatHistory: Array<{ role: string; content: string }>;
  patientProfile?: {
    name?: string;
    age?: number;
    emotionalState?: string;
    isBadNewsCase?: boolean;
  };
}): Promise<RelationalAuditResult> {
  const { chatHistory, patientProfile } = params;

  if (!chatHistory || chatHistory.length === 0) {
    return {
      status: "NOT_EVALUABLE",
      overallVerdict: "MECHANICAL_TRANSACTIONAL",
      careEmpathyScore: 0,
      riasMetrics: {
        empathyValidationCount: 0,
        jargonWithoutExplanationCount: 0,
        activeListeningScore: 0,
        sharedDecisionMakingScore: 0,
      },
      careMeasureChecklist: [],
      criticalRelationalFlaws: [
        {
          doctorUtteranceOrOmission: "Nessun dialogo avviato con il paziente.",
          psychologicalImpact: "Assenza totale di relazione terapeutica.",
          riasViolationType: "Absence of Verbal Interaction",
          suggestedEvidenceBasedAlternative:
            "Avviare la consultazione con accoglienza ed esplorazione dei sintomi.",
        },
      ],
      spikesProtocolCompliance: {
        isApplicable: false,
        adherenceScorePercentage: 0,
        missedSteps: [],
      },
    };
  }

  const userPrompt = `
<<<PATIENT_PROFILE>>>
${JSON.stringify(patientProfile || {}, null, 2)}
<<<END_PATIENT_PROFILE>>>

<<<CHAT_HISTORY>>>
${JSON.stringify(chatHistory, null, 2)}
<<<END_CHAT_HISTORY>>>
`;

  const { object } = await generateObject({
    model: openai("gpt-4o"),
    temperature: 0,
    system: RELATIONAL_AUDIT_SYSTEM_PROMPT,
    prompt: userPrompt,
    schema: RelationalAuditResultSchema,
  });

  return object;
}
