import { generateObject } from "ai";
import { MODEL_GPT_61_TERRA, openAIObjectCall } from "@/lib/ai/models";
import { asOpenAIStrictSchema } from "@/lib/ai/strict-schema";
import { z } from "zod";
import { withOpenAIRetry } from "@/lib/ai/openai-retry";
import { createLogger } from "@/lib/logger";
import type { RagPillarTrace } from "@/lib/reports/pillar-radar";
import { isLabEvaluationCase } from "@/lib/reports/lab-evaluation-labels";
import type { RelevantGuidelines } from "@/lib/services/rag-service";
import { sanitizeForExternalAI } from "@/lib/security/sanitize-for-ai";
import { fenceContext, truncateForLlmContext } from "@/lib/security/prompt-context";

const log = createLogger("rag-pillar-evaluation");

const PILLAR_FEEDBACK_MAX = 1200;

const pillarSchema = z.object({
  score: z.number().min(0).max(100),
  feedback: z.string().max(PILLAR_FEEDBACK_MAX),
});

/** Structured examiner output: four pillars, each with score and analytical feedback. */
export const RagPillarEvaluationSchema = z.object({
  clinica: pillarSchema,
  economia: pillarSchema,
  legale: pillarSchema,
  empatia: pillarSchema,
});

export type SelectedReportOption = {
  id: string;
  label: string;
  nodeId?: string;
};

export type ReportCaseData = {
  id?: string;
  title?: string;
  specialty?: string;
  description?: string;
  patientPrompt?: string;
  difficulty?: string;
};

export type RagTraceChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/**
 * Search query for the vector store: case title, current specialty,
 * and the key choices the user made on decision nodes.
 */
export function buildDocumentSearchQuery(input: {
  title?: string | null;
  specialty?: string | null;
  selectedOptions?: SelectedReportOption[] | null;
}): string {
  const optionText = (input.selectedOptions ?? [])
    .map((option) => option.label?.trim() || option.id?.trim())
    .filter((part): part is string => Boolean(part))
    .slice(0, 12)
    .join("; ");

  const parts = [
    input.title?.trim(),
    input.specialty?.trim(),
    optionText,
    "linee guida cliniche Legge 219/2017 nomenclatore tariffario choosing wisely consenso informato",
  ].filter((part): part is string => Boolean(part && part.length > 0));

  return parts.join("\n");
}

/** Concatenates protocol, tariff and legal chunks into the examiner context. */
export function concatenateRetrievedContext(guidelines: RelevantGuidelines): string {
  const sections = [guidelines.protocol, guidelines.economic, guidelines.legal]
    .map((section) => section?.combinedText?.trim() ?? "")
    .filter((text) => text.length > 0);

  if (sections.length === 0) {
    return "Nessun frammento documentale recuperato dal database (linee guida cliniche, Legge 219/2017, nomenclatori tariffari).";
  }

  return truncateForLlmContext(sections.join("\n\n---\n\n"), 14_000);
}

export function buildRagExaminerSystemPrompt(retrievedContext: string): string {
  return `Sei un esaminatore universitario inflessibile. Il tuo compito è valutare il tracciato dell'utente confrontandolo ESCLUSIVAMENTE con i seguenti documenti ufficiali estratti dal database:
${retrievedContext}
Regole per i 4 pilastri:
1. CLINICA: Valuta la coerenza tra le scelte dell'utente (selectedOptions) e i gold standard presenti nei documenti estratti. Penalizza ogni deviazione dai protocolli. Cita esplicitamente quale linea guida è stata violata o rispettata.
2. ECONOMIA E PRESCRIZIONI: Cerca nei documenti riferimenti a costi, appropriatezza e choosing wisely. Se l'utente ha richiesto esami ridondanti o non indicati in urgenza, penalizzalo citando lo spreco di risorse.
3. TUTELA LEGALE: Confronta l'operato con i documenti legali (es. Legge 219). Controlla se è stato violato il consenso informato, se sono stati eseguiti test senza autorizzazione o se la refertazione omette dati critici.
4. EMPATIA (Comunicazione): Analizza la \`chatHistory\`. L'utente è stato chiaro, rassicurante e ha evitato gergo medico incomprensibile? Ha gestito le ansie del paziente/collega secondo i framework comunicativi standard?
Per ogni pilastro, devi giustificare il voto citando l'azione specifica dell'utente e il documento di riferimento. NON inventare regole mediche non presenti nel contesto fornito.`;
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function clipFeedback(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Nessuna giustificazione ancorata ai documenti recuperati.";
  }
  return trimmed.length > PILLAR_FEEDBACK_MAX
    ? trimmed.slice(0, PILLAR_FEEDBACK_MAX)
    : trimmed;
}

function sourceTitles(guidelines: RelevantGuidelines): string[] {
  const titles = [
    ...(guidelines.protocol?.sources ?? []),
    ...(guidelines.economic?.sources ?? []),
    ...(guidelines.legal?.sources ?? []),
  ];
  return [...new Set(titles.map((title) => title.trim()).filter(Boolean))].slice(0, 24);
}

function buildUserPrompt(input: {
  caseData: ReportCaseData;
  selectedOptions: SelectedReportOption[];
  chatHistory: RagTraceChatMessage[];
  exams: Array<{ id: string; name: string; cost: number }>;
  reportText?: string;
}): string {
  const casePayload = {
    id: input.caseData.id ?? "",
    title: input.caseData.title ?? "",
    specialty: input.caseData.specialty ?? "",
    difficulty: input.caseData.difficulty ?? "",
    description: sanitizeForExternalAI(input.caseData.description ?? "").slice(0, 2500),
    patientPrompt: sanitizeForExternalAI(input.caseData.patientPrompt ?? "").slice(0, 2500),
  };
  const options = input.selectedOptions.slice(0, 40).map((option) => ({
    id: option.id.slice(0, 200),
    label: sanitizeForExternalAI(option.label).slice(0, 400),
    ...(option.nodeId ? { nodeId: option.nodeId.slice(0, 200) } : {}),
  }));
  const chat = input.chatHistory.slice(-48).map((turn) => ({
    role: turn.role,
    content: sanitizeForExternalAI(turn.content).slice(0, 1500),
  }));
  const exams = input.exams.slice(0, 40).map((exam) => ({
    id: exam.id.slice(0, 120),
    name: sanitizeForExternalAI(exam.name).slice(0, 200),
    cost: Number.isFinite(exam.cost) ? exam.cost : 0,
  }));

  return [
    "Valuta il tracciato seguente. Restituisci solo i 4 pilastri (clinica, economia, legale, empatia), ciascuno con score 0-100 e feedback analitico citando l'azione dell'utente e il documento nel contesto.",
    fenceContext("CASE_DATA", JSON.stringify(casePayload)),
    fenceContext("SELECTED_OPTIONS", JSON.stringify(options)),
    fenceContext("CHAT_HISTORY", JSON.stringify(chat)),
    fenceContext("EXAMS", JSON.stringify(exams)),
    fenceContext(
      "REPORT_TEXT",
      sanitizeForExternalAI(input.reportText ?? "").slice(0, 4000) || "Nessun referto.",
    ),
  ].join("\n\n");
}

export async function evaluateTraceAgainstDocuments(input: {
  caseData: ReportCaseData;
  selectedOptions: SelectedReportOption[];
  chatHistory: RagTraceChatMessage[];
  exams?: Array<{ id: string; name: string; cost: number }>;
  reportText?: string;
  guidelines: RelevantGuidelines;
  specialty?: string | null;
  caseId?: string | null;
}): Promise<RagPillarTrace> {
  const retrievedContext = concatenateRetrievedContext(input.guidelines);
  const isLab = isLabEvaluationCase({
    specialty: input.caseData.specialty ?? input.specialty,
    caseId: input.caseData.id ?? input.caseId,
  });

  const result = await withOpenAIRetry(() =>
    generateObject({
      ...openAIObjectCall(MODEL_GPT_61_TERRA),
      schema: asOpenAIStrictSchema(RagPillarEvaluationSchema),
      maxRetries: 3,
      system: buildRagExaminerSystemPrompt(retrievedContext),
      prompt: buildUserPrompt({
        caseData: input.caseData,
        selectedOptions: input.selectedOptions,
        chatHistory: input.chatHistory,
        exams: input.exams ?? [],
        reportText: input.reportText,
      }),
    }),
  );

  const object = result.object;
  const trace: RagPillarTrace = {
    authoritative: true,
    isLab,
    retrievedQuery: input.guidelines.query,
    sourceTitles: sourceTitles(input.guidelines),
    clinica: {
      score: clampScore(object.clinica.score),
      feedback: clipFeedback(object.clinica.feedback),
    },
    economia: {
      score: clampScore(object.economia.score),
      feedback: clipFeedback(object.economia.feedback),
    },
    legale: {
      score: clampScore(object.legale.score),
      feedback: clipFeedback(object.legale.feedback),
    },
    empatia: {
      score: clampScore(object.empatia.score),
      feedback: clipFeedback(object.empatia.feedback),
    },
  };

  log.info("RAG pillar evaluation completed", {
    isLab,
    clinica: trace.clinica.score,
    economia: trace.economia.score,
    legale: trace.legale.score,
    empatia: trace.empatia.score,
    sourceCount: trace.sourceTitles.length,
    contextChars: retrievedContext.length,
  });

  return trace;
}
