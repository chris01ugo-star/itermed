import { z } from "zod";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import type { PatientProfile } from "@/lib/data/cases/types";
import {
  classifyDoctorIntentLexical,
  evaluateInteractionTrajectory,
  type ClassifiedDoctorTurn,
  type DRimeResult,
} from "@/lib/reports/d-rime-engine";
import {
  DOCTOR_INTENT_CATEGORIES,
  LLM_INTENT_CONFIDENCE_THRESHOLD,
  areHighConfidenceIntentsAmbiguous,
  isDoctorIntentCategory,
  type ClassifiedIntent,
  type DoctorIntentCategory,
} from "@/lib/services/d-rime-fsm";

export const DoctorIntentCategorySchema = z.enum(DOCTOR_INTENT_CATEGORIES);

export const DoctorIntentExtractionSchema = z.object({
  turns: z
    .array(
      z.object({
        turnIndex: z.number().int().min(0),
        utteranceExcerpt: z.string().max(240),
        intents: z
          .array(
            z.object({
              category: DoctorIntentCategorySchema,
              confidence: z.number().min(0).max(1),
              explanation: z.string().max(400),
            }),
          )
          .min(1)
          .max(3),
      }),
    )
    .max(48),
});

export type DoctorIntentExtraction = z.infer<typeof DoctorIntentExtractionSchema>;

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
  /** Deterministic FSM snapshot — T/A/D never originate from the LLM. */
  dRimeFsm: z
    .object({
      intentSource: z.enum(["llm", "lexical_fallback", "mixed"]),
      initialState: z.object({
        trust: z.number(),
        anxiety: z.number(),
        defensiveness: z.number(),
      }),
      finalState: z.object({
        trust: z.number(),
        anxiety: z.number(),
        defensiveness: z.number(),
      }),
      classifiedIntents: z.array(
        z.object({
          turnIndex: z.number(),
          utteranceExcerpt: z.string().optional(),
          intents: z.array(
            z.object({
              category: DoctorIntentCategorySchema,
              confidence: z.number(),
              explanation: z.string(),
            }),
          ),
        }),
      ),
    })
    .optional(),
});

export type RelationalAuditResult = z.infer<typeof RelationalAuditResultSchema>;

export const RELATIONAL_AUDIT_SYSTEM_PROMPT = `
SEI UN CLASSIFICATORE DI INTENTI COMUNICATIVI IN CONSULENZA CLINICA (RIAS / SPIKES / CARE).
IL TUO UNICO COMPITO È ETICHETTARE OGNI TURNO DEL MEDICO (role=user) IN UNA O PIÙ CATEGORIE D-RIME.

CATEGORIE AMMESSE (usa ESATTAMENTE questi identificatori):
- EMPATHIC_EXPLORATION: ascolto aperto, domande sulla percezione/paura, alleanza.
- PATERNALISTIC_COMMAND: tono direttivo, sdegno, minimizzazione, "faccia come dico".
- VALIDATION: legittimazione emotiva ANCORATA al vissuto specifico del paziente (SPIKES-Emotions). Esempio: "Capisco la paura dell'infarto dopo quello che è successo a suo padre".
- FORMULAIC_EMPATHY: Frasi fatte, rassicurazioni meccaniche o copia-incolla non ancorate al vissuto specifico del paziente (es. "Stia tranquillo", "Andrà tutto bene", "Non si preoccupi", "Va tutto bene"). NON è VALIDATION.
- EMOTIONAL_BYPASS: Ignorare un'emozione forte (paura/rabbia) espressa nel turno precedente, rispondendo immediatamente con una domanda clinica o tecnica.
- OPTION_ELICITATION: Coinvolgere il paziente nella scelta terapeutica (Shared Decision Making): "Quale opzione preferisce?", "Insieme decidiamo se…", alternative di trattamento esplicitate.
- DEFENSIVE_REACTION: concessione a richieste inappropriate / medicina difensiva.
- CLINICAL_DISCLOSURE: spiegazione clinica in linguaggio accessibile (SPIKES-Knowledge).
- DISCORDANCE: mismatch relazionale, distress del paziente ignorato, conflitto (senza salto immediato al task clinico).
- NEUTRAL: atto clinico transazionale senza carico relazionale.

REGOLE TASSATIVE:
1. NON generare punteggi numerici, NON stimare Trust/Anxiety/Defensiveness, NON calcolare delta (ΔT, ΔA, ΔD).
2. NON produrre overallVerdict, CARE score, RIAS score o SPIKES score — quelli sono calcolati da una FSM deterministica.
3. Classifica SOLO le evidenze testuali del medico (role=user). I turni del paziente servono come contesto.
4. Per ogni turno medico: 1–3 intenti, ciascuno con confidence 0–1 e una spiegazione breve ancorata alla citazione.
5. Se non sei sicuro (confidence < 0.60) etichetta NEUTRAL. Non inventare intenti relazionali marcati.
6. Se il medico ignora un segnale di distress del paziente nel turno successivo, includi DISCORDANCE.
7. Distingui VALIDATION (specifica, ancorata) da FORMULAIC_EMPATHY (frase fatta). In dubbio su una rassicurazione generica, usa FORMULAIC_EMPATHY.
8. Se il turno precedente del paziente esprime paura o rabbia e il medico risponde con una domanda clinica/tecnica senza accogliere l'emozione, etichetta EMOTIONAL_BYPASS (non VALIDATION, non EMPATHIC_EXPLORATION).
9. OPTION_ELICITATION richiede un coinvolgimento esplicito nella scelta. Non basta dire "procediamo" o "le prescrivo".
`;

const emptyAudit = (params?: {
  isBadNewsCase?: boolean;
  omission?: string;
}): RelationalAuditResult => ({
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
      doctorUtteranceOrOmission: params?.omission ?? "Nessun dialogo avviato con il paziente.",
      psychologicalImpact: "Assenza totale di relazione terapeutica.",
      riasViolationType: "Absence of Verbal Interaction",
      suggestedEvidenceBasedAlternative:
        "Avviare la consultazione con accoglienza ed esplorazione dei sintomi.",
    },
  ],
  spikesProtocolCompliance: {
    isApplicable: Boolean(params?.isBadNewsCase),
    adherenceScorePercentage: 0,
    missedSteps: [],
  },
});

function verdictFromScore(
  score: number,
): RelationalAuditResult["overallVerdict"] {
  if (score >= 85) return "EXCELLENT_RELATIONAL_CARE";
  if (score >= 70) return "SATISFACTORY_RELATIONAL_CARE";
  if (score >= 40) return "MECHANICAL_TRANSACTIONAL";
  return "RELATIONAL_FAIL_OR_IATROGENIC_DISTRESS";
}

function doctorUtterances(chatHistory: Array<{ role: string; content: string }>): string[] {
  return chatHistory
    .filter((m) => m.role === "user" && typeof m.content === "string" && m.content.trim())
    .map((m) => m.content.trim());
}

function isAmbiguousOrLowConfidence(intents: ClassifiedIntent[]): boolean {
  const valid = intents.filter(
    (row) =>
      isDoctorIntentCategory(row.category) &&
      Number.isFinite(row.confidence) &&
      row.confidence >= LLM_INTENT_CONFIDENCE_THRESHOLD,
  );
  if (valid.length === 0) return true;
  return areHighConfidenceIntentsAmbiguous(valid);
}

/**
 * LLM → lexical regex → NEUTRAL. Low-confidence labels never reach the FSM.
 */
export function gateClassifiedIntentsForFsm(
  classified: ClassifiedDoctorTurn[],
  chatHistory: Array<{ role: string; content: string }>,
): { turns: ClassifiedDoctorTurn[]; intentSource: "llm" | "lexical_fallback" | "mixed" } {
  const utterances = doctorUtterances(chatHistory);
  if (classified.length === 0) {
    const turns = utterances.map((utterance, turnIndex) => {
      const category = classifyDoctorIntentLexical(utterance, { requireClearMatch: true });
      return {
        turnIndex,
        utteranceExcerpt: utterance.slice(0, 240),
        intents: [
          {
            category,
            confidence: 1,
            explanation:
              category === "NEUTRAL"
                ? "Nessun intento LLM; classificatore lessicale senza match chiaro → NEUTRAL (Δ = 0)."
                : "Nessun intento LLM; intento da classificatore lessicale offline.",
          },
        ],
      } satisfies ClassifiedDoctorTurn;
    });
    return { turns, intentSource: "lexical_fallback" };
  }

  let usedLlm = false;
  let usedLexical = false;
  const turns = classified.map((turn) => {
    const utterance =
      utterances[turn.turnIndex] ?? turn.utteranceExcerpt ?? "";
    if (!isAmbiguousOrLowConfidence(turn.intents)) {
      usedLlm = true;
      return {
        ...turn,
        intents: turn.intents.filter(
          (row) =>
            isDoctorIntentCategory(row.category) &&
            Number.isFinite(row.confidence) &&
            row.confidence >= LLM_INTENT_CONFIDENCE_THRESHOLD,
        ),
      };
    }
    usedLexical = true;
    const category = classifyDoctorIntentLexical(utterance, { requireClearMatch: true });
    return {
      turnIndex: turn.turnIndex,
      utteranceExcerpt: turn.utteranceExcerpt ?? utterance.slice(0, 240),
      intents: [
        {
          category,
          confidence: 1,
          explanation:
            category === "NEUTRAL"
              ? `LLM confidence < ${LLM_INTENT_CONFIDENCE_THRESHOLD} o output ambiguo; nessun match lessicale chiaro → NEUTRAL (Δ = 0).`
              : `LLM confidence < ${LLM_INTENT_CONFIDENCE_THRESHOLD} o output ambiguo; intento da classificatore lessicale offline.`,
        },
      ],
    } satisfies ClassifiedDoctorTurn;
  });

  const intentSource: "llm" | "lexical_fallback" | "mixed" =
    usedLlm && usedLexical ? "mixed" : usedLlm ? "llm" : "lexical_fallback";
  return { turns, intentSource };
}

function evidenceFor(
  dRime: DRimeResult,
  category: DoctorIntentCategory,
): string | undefined {
  const act = dRime.acts.find((a) => a.intent === category || a.intents.includes(category));
  return act?.utterance.slice(0, 180);
}

export function mapDRimeToRelationalAudit(params: {
  dRime: DRimeResult;
  classifiedIntents: ClassifiedDoctorTurn[];
  intentSource: "llm" | "lexical_fallback" | "mixed";
  isBadNewsCase?: boolean;
}): RelationalAuditResult {
  const { dRime } = params;
  const validationCount = dRime.acts.filter((a) => a.intents.includes("VALIDATION")).length;
  const explorationCount = dRime.acts.filter((a) =>
    a.intents.includes("EMPATHIC_EXPLORATION"),
  ).length;
  const paternalism = dRime.acts.filter((a) => a.intents.includes("PATERNALISTIC_COMMAND"));
  const discord = dRime.acts.filter((a) => a.intents.includes("DISCORDANCE"));
  const defensive = dRime.acts.filter((a) => a.intents.includes("DEFENSIVE_REACTION"));
  const formulaic = dRime.acts.filter((a) => a.intents.includes("FORMULAIC_EMPATHY"));
  const bypass = dRime.acts.filter((a) => a.intents.includes("EMOTIONAL_BYPASS"));
  const optionElicitation = dRime.acts.filter((a) =>
    a.intents.includes("OPTION_ELICITATION"),
  ).length;

  const missedSpikes: string[] = [];
  if (explorationCount === 0) missedSpikes.push("Perception / Invitation");
  if (!dRime.acts.some((a) => a.intents.includes("CLINICAL_DISCLOSURE"))) {
    missedSpikes.push("Knowledge");
  }
  if (validationCount === 0) missedSpikes.push("Emotions");

  const flaws: RelationalAuditResult["criticalRelationalFlaws"] = [];
  for (const act of paternalism) {
    flaws.push({
      doctorUtteranceOrOmission: act.utterance.slice(0, 240),
      psychologicalImpact: "Aumento deterministico di Anxiety e Defensiveness (FSM: PATERNALISTIC_COMMAND).",
      riasViolationType: "Paternalistic / task-only dominance",
      suggestedEvidenceBasedAlternative:
        "Legittimare l'emozione (VALIDATION) e esplorare la percezione (EMPATHIC_EXPLORATION) prima del piano.",
    });
  }
  for (const act of discord) {
    flaws.push({
      doctorUtteranceOrOmission: act.utterance.slice(0, 240),
      psychologicalImpact: "Distress non raccolto — transizione FSM DISCORDANCE.",
      riasViolationType: "Ignored socio-emotional cue",
      suggestedEvidenceBasedAlternative:
        "Nel turno successivo, validare il distress prima di qualsiasi informazione tecnica.",
    });
  }
  for (const act of bypass) {
    flaws.push({
      doctorUtteranceOrOmission: act.utterance.slice(0, 240),
      psychologicalImpact:
        "Bypass emotivo: Trust in crollo e Anxiety in picco (FSM: EMOTIONAL_BYPASS).",
      riasViolationType: "Emotional bypass / task intrusion after affect",
      suggestedEvidenceBasedAlternative:
        "Validare paura o rabbia (VALIDATION) prima di qualsiasi domanda clinica.",
    });
  }
  for (const act of formulaic) {
    flaws.push({
      doctorUtteranceOrOmission: act.utterance.slice(0, 240),
      psychologicalImpact:
        "Rassicurazione meccanica: il paziente legge inautenticità (FSM: FORMULAIC_EMPATHY, Trust− Defensiveness+).",
      riasViolationType: "Formulaic / non-specific empathy",
      suggestedEvidenceBasedAlternative:
        "Ancorare la validazione al contenuto emotivo appena espresso dal paziente, non a una frase fatta.",
    });
  }
  for (const act of defensive) {
    flaws.push({
      doctorUtteranceOrOmission: act.utterance.slice(0, 240),
      psychologicalImpact: "Concessione difensiva: appeasement a breve, rinforzo del bias.",
      riasViolationType: "Defensive medicine / inappropriate concession",
      suggestedEvidenceBasedAlternative:
        "Spiegare l'inappropriatezza (CLINICAL_DISCLOSURE) dopo VALIDATION, senza prescrivere esami non indicati.",
    });
  }

  return {
    status: "EVALUATED",
    overallVerdict: verdictFromScore(dRime.score),
    careEmpathyScore: dRime.careTrustScore,
    riasMetrics: {
      empathyValidationCount: validationCount,
      jargonWithoutExplanationCount: paternalism.length,
      activeListeningScore: dRime.riasAlignmentScore,
      sharedDecisionMakingScore: Math.min(
        100,
        optionElicitation * 40 + explorationCount * 10,
      ),
    },
    careMeasureChecklist: [
      {
        dimension: "Listening",
        observed: explorationCount > 0,
        evidenceUtterance: evidenceFor(dRime, "EMPATHIC_EXPLORATION"),
        clinicalImpactNote: "RIAS socio-emotional / SPIKES-Perception.",
      },
      {
        dimension: "Emotional validation",
        observed: validationCount > 0,
        evidenceUtterance: evidenceFor(dRime, "VALIDATION"),
        clinicalImpactNote: "SPIKES-Emotions / CARE.",
      },
      {
        dimension: "Explanation",
        observed: dRime.acts.some((a) => a.intents.includes("CLINICAL_DISCLOSURE")),
        evidenceUtterance: evidenceFor(dRime, "CLINICAL_DISCLOSURE"),
        clinicalImpactNote: "SPIKES-Knowledge / CARE explanation.",
      },
      {
        dimension: "Helping to take control",
        observed: optionElicitation > 0,
        evidenceUtterance: evidenceFor(dRime, "OPTION_ELICITATION"),
        clinicalImpactNote: "Shared decision making (OPTION_ELICITATION).",
      },
    ],
    criticalRelationalFlaws: flaws,
    spikesProtocolCompliance: {
      isApplicable: Boolean(params.isBadNewsCase) || dRime.acts.length > 0,
      adherenceScorePercentage: dRime.spikesEmpathyScore,
      missedSteps: missedSpikes,
    },
    dRimeFsm: {
      intentSource: params.intentSource,
      initialState: dRime.initialState,
      finalState: dRime.finalState,
      classifiedIntents: params.classifiedIntents,
    },
  };
}

export async function extractDoctorIntents(params: {
  chatHistory: Array<{ role: string; content: string }>;
  patientProfile?: {
    name?: string;
    age?: number;
    emotionalState?: string;
    isBadNewsCase?: boolean;
  };
}): Promise<ClassifiedDoctorTurn[]> {
  const doctorTurns = params.chatHistory.filter(
    (m) => m.role === "user" && typeof m.content === "string" && m.content.trim(),
  );
  if (doctorTurns.length === 0) return [];

  const userPrompt = `
<<<PATIENT_PROFILE>>>
${JSON.stringify(params.patientProfile || {}, null, 2)}
<<<END_PATIENT_PROFILE>>>

<<<CHAT_HISTORY>>>
${JSON.stringify(params.chatHistory, null, 2)}
<<<END_CHAT_HISTORY>>>

Classifica ogni turno del medico (role=user) in ordine (turnIndex 0-based sui soli turni medico).
NON restituire Trust, Anxiety, Defensiveness, né alcun punteggio CARE/RIAS/SPIKES.
`;

  const { object } = await generateObject({
    model: openai("gpt-4o"),
    temperature: 0,
    system: RELATIONAL_AUDIT_SYSTEM_PROMPT,
    prompt: userPrompt,
    schema: DoctorIntentExtractionSchema,
  });

  return object.turns.map((turn) => ({
    turnIndex: turn.turnIndex,
    utteranceExcerpt: turn.utteranceExcerpt,
    intents: turn.intents,
  }));
}

export async function runRelationalAudit(params: {
  chatHistory: Array<{ role: string; content: string }>;
  patientProfile?: {
    name?: string;
    age?: number;
    emotionalState?: string;
    isBadNewsCase?: boolean;
  };
  clinicalPatientProfile?: PatientProfile | null;
  classifiedIntents?: ClassifiedDoctorTurn[] | null;
  goldStandardPath?: string[] | null;
  prescribedMedicationCount?: number;
  therapyDecisionRequired?: boolean;
}): Promise<RelationalAuditResult> {
  const { chatHistory, patientProfile } = params;

  if (!chatHistory || chatHistory.length === 0) {
    return emptyAudit({ isBadNewsCase: patientProfile?.isBadNewsCase });
  }

  let classifiedIntents: ClassifiedDoctorTurn[] = params.classifiedIntents ?? [];
  if (classifiedIntents.length === 0) {
    try {
      classifiedIntents = await extractDoctorIntents({
        chatHistory,
        patientProfile,
      });
    } catch {
      classifiedIntents = [];
    }
  }

  const gated = gateClassifiedIntentsForFsm(classifiedIntents, chatHistory);
  classifiedIntents = gated.turns;
  const intentSource = gated.intentSource;

  const dRime = evaluateInteractionTrajectory(
    chatHistory,
    params.clinicalPatientProfile ?? null,
    null,
    {
      classifiedIntents: classifiedIntents.length > 0 ? classifiedIntents : null,
      goldStandardPath: params.goldStandardPath,
      prescribedMedicationCount: params.prescribedMedicationCount,
      therapyDecisionRequired: params.therapyDecisionRequired,
    },
  );

  return mapDRimeToRelationalAudit({
    dRime,
    classifiedIntents,
    intentSource,
    isBadNewsCase: patientProfile?.isBadNewsCase,
  });
}
