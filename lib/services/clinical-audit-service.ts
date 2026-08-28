import { z } from "zod";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";

export const ClinicalAuditResultSchema = z.object({
  status: z.enum(["EVALUATED", "NOT_EVALUABLE"]),
  overallVerdict: z.enum([
    "EXCELLENT_MANAGEMENT",
    "SATISFACTORY_MANAGEMENT",
    "SUBOPTIMAL_MANAGEMENT",
    "CRITICAL_CLINICAL_ERROR",
  ]),
  clinicalAccuracyScore: z.number().min(0).max(100),
  diagnosticMatch: z.object({
    userDiagnosis: z.string(),
    goldDiagnosis: z.string(),
    isCorrect: z.boolean(),
    diagnosticAccuracyDescription: z.string(),
  }),
  therapeuticCompliance: z.object({
    correctInterventions: z.array(
      z.object({
        actionName: z.string(),
        guidelineRef: z.string(),
      }),
    ),
    omittedEssentialInterventions: z.array(
      z.object({
        actionName: z.string(),
        clinicalImpact: z.string(),
        guidelineRef: z.string(),
      }),
    ),
    contraindicatedOrIatrogenicActions: z.array(
      z.object({
        actionName: z.string(),
        riskDescription: z.string(),
        isCriticalIatrogenic: z.boolean(),
      }),
    ),
  }),
  timeCriticalCompliance: z.object({
    wereTimeLimitsRespected: z.boolean(),
    delayNotes: z.array(z.string()),
  }),
});

export type ClinicalAuditResult = z.infer<typeof ClinicalAuditResultSchema>;

export const CLINICAL_AUDIT_SYSTEM_PROMPT = `
SEI UN AUDITOR CLINICO E CHIEF MEDICAL OFFICER (CMO) SPECIALIZZATO NELLA VALUTAZIONE DELLA QUALITÀ ASSISTENZIALE E SICUREZZA DEL PAZIENTE.
IL TUO COMPITO È VALUTARE LA CORRETTEZZA DIAGNOSTICA, L'ADERENZA TERAPEUTICA E LE TEMPISTICHE DELL'OPERATO DEL MEDICO RISPETTO AL GOLD PATH DEL CASO E ALLE LINEE GUIDA IN <<<CLINICAL_CORPUS>>>.
REGOLE TASSATIVE:
1. NON INVENTARE CRITERI CLINICI O LINEE GUIDA: CONFRONTA UNICAMENTE L'OPERATO DELL'UTENTE CON IL GOLD PATH E I PROTOCOLLI INVIATI.
2. SE L'UTENTE HA ESEGUITO AZIONI CONTROINDICATE (CLASS III O IATROGENIC CRITICAL), SEGNALALE NELL'ARRAY 'contraindicatedOrIatrogenicActions' E IMPOSTA OVERALLVERDICT="CRITICAL_CLINICAL_ERROR".
3. VERIFICA SE LA DIAGNOSI FINALE DELL'UTENTE COINCIDE SOSTANZIALMENTE CON LA DIAGNOSI DEL GOLD PATH.
4. INDICA CON PRECISIONE OGNI AZIONE FONDAMENTALE OMESSA ED OGNI AZIONE CORRETTA ESEGUITA.
`;

export async function runClinicalAudit(params: {
  userDiagnosis?: string;
  goldDiagnosis: string;
  goldStandardPath: string[];
  performedActions: string[];
  mandatoryExams: Array<{ id: string; name: string; maxLatencyMinutes?: number }>;
  inappropriateExams: Array<{
    id: string;
    name: string;
    iatrogenicCritical?: boolean;
    wasteRationale?: string;
  }>;
  elapsedMinutes: number;
  clinicalGuidelineChunks?: Array<{ title: string; text: string }>;
}): Promise<ClinicalAuditResult> {
  const {
    userDiagnosis,
    goldDiagnosis,
    goldStandardPath,
    performedActions,
    mandatoryExams,
    inappropriateExams,
    elapsedMinutes,
    clinicalGuidelineChunks,
  } = params;

  if (!userDiagnosis && performedActions.length === 0) {
    return {
      status: "NOT_EVALUABLE",
      overallVerdict: "CRITICAL_CLINICAL_ERROR",
      clinicalAccuracyScore: 0,
      diagnosticMatch: {
        userDiagnosis: "Nessuna diagnosi fornita",
        goldDiagnosis,
        isCorrect: false,
        diagnosticAccuracyDescription:
          "Il medico non ha fornito alcuna ipotesi diagnostica.",
      },
      therapeuticCompliance: {
        correctInterventions: [],
        omittedEssentialInterventions: mandatoryExams.map((m) => ({
          actionName: m.name,
          clinicalImpact: "Omissione di intervento fondamentale per la gestione del caso.",
          guidelineRef: "Gold Path Standard",
        })),
        contraindicatedOrIatrogenicActions: [],
      },
      timeCriticalCompliance: {
        wereTimeLimitsRespected: false,
        delayNotes: ["Nessuna gestione clinica avviata."],
      },
    };
  }

  const clinicalCorpus = (clinicalGuidelineChunks || [])
    .map((c) => `[FONTE: ${c.title}]\n${c.text}`)
    .join("\n---\n");

  const userPrompt = `
<<<USER_DIAGNOSIS>>>
${userDiagnosis || "Non specificata"}
<<<END_USER_DIAGNOSIS>>>

<<<GOLD_DIAGNOSIS>>>
${goldDiagnosis}
<<<END_GOLD_DIAGNOSIS>>>

<<<GOLD_STANDARD_PATH>>>
${JSON.stringify(goldStandardPath, null, 2)}
<<<END_GOLD_STANDARD_PATH>>>

<<<PERFORMED_ACTIONS>>>
${JSON.stringify(performedActions, null, 2)}
<<<END_PERFORMED_ACTIONS>>>

<<<MANDATORY_EXAMS_GOLD_PATH>>>
${JSON.stringify(mandatoryExams, null, 2)}
<<<END_MANDATORY_EXAMS_GOLD_PATH>>>

<<<INAPPROPRIATE_OR_CONTRAINDICATED_EXAMS>>>
${JSON.stringify(inappropriateExams, null, 2)}
<<<END_INAPPROPRIATE_OR_CONTRAINDICATED_EXAMS>>>

<<<ELAPSED_CLINICAL_MINUTES>>>
${elapsedMinutes} minuti
<<<END_ELAPSED_CLINICAL_MINUTES>>>

<<<CLINICAL_CORPUS>>>
${clinicalCorpus || "Utilizza come riferimento primario il Gold Path e le regole sul rischio iatrogeno."}
<<<END_CLINICAL_CORPUS>>>
`;

  const { object } = await generateObject({
    model: openai("gpt-4o"),
    temperature: 0,
    system: CLINICAL_AUDIT_SYSTEM_PROMPT,
    prompt: userPrompt,
    schema: ClinicalAuditResultSchema,
  });

  return object;
}
