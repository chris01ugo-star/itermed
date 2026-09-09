import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { getSessionUserId } from "@/lib/api-session";
import { requireTeacherApi } from "@/lib/cases/require-teacher-api";
import { createLogger } from "@/lib/logger";
import { sanitizeForExternalAI } from "@/lib/security/sanitize-for-ai";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { AI_RATE_LIMITS } from "@/lib/security/ai-rate-limits";
import { AI_PROMPT_INJECTION_GUARD } from "@/lib/security/ai-prompt-guards";
import { withOpenAIRetry } from "@/lib/ai/openai-retry";

export const runtime = "nodejs";
export const maxDuration = 60;

const logger = createLogger("generate-case-fields");

const MIN_BRIEF_CHARS = 20;
const MAX_BRIEF_CHARS = 4_000;

/** Structured payload returned to the Create Case wizard. */
export const GeneratedCaseFieldsSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(4000),
  specialty: z.string().max(120),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  age: z.string().max(10),
  sex: z.enum(["M", "F"]),
  context: z.string().max(500),
  pastMedicalHistory: z.string().max(4000),
  correctSolution: z.string().max(4000),
  vitals_fc: z.string().max(40),
  vitals_pa: z.string().max(40),
  vitals_spo2: z.string().max(40),
  vitals_temp: z.string().max(40),
  vitals_fr: z.string().max(40),
  /** Sintesi delle alterazioni attese (lab/strumentali) da mostrare/archiviare nell'anamnesi. */
  abnormalExamsSummary: z.string().max(2000),
});

export type GeneratedCaseFields = z.infer<typeof GeneratedCaseFieldsSchema>;

type RequestBody = {
  brief?: unknown;
  caseDescription?: unknown;
};

export async function POST(req: Request) {
  const denied = await requireTeacherApi();
  if (denied) return denied;

  const userId = await getSessionUserId();
  if (!userId) {
    return Response.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  const rateLimited = await enforceRateLimit(req, {
    namespace: "api-generate-case-fields",
    limit: AI_RATE_LIMITS.generateCaseFields,
    userId,
  });
  if (rateLimited) return rateLimited;

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return Response.json({ error: "JSON non valido" }, { status: 400 });
  }

  const rawBrief =
    (typeof body.brief === "string" && body.brief) ||
    (typeof body.caseDescription === "string" && body.caseDescription) ||
    "";
  const brief = sanitizeForExternalAI(rawBrief.trim()).slice(0, MAX_BRIEF_CHARS);

  if (brief.length < MIN_BRIEF_CHARS) {
    return Response.json(
      {
        error: `Inserisci un riassunto clinico di almeno ${MIN_BRIEF_CHARS} caratteri.`,
        code: "BRIEF_TOO_SHORT",
      },
      { status: 400 },
    );
  }

  try {
    const { object } = await withOpenAIRetry(() =>
      generateObject({
        model: openai("gpt-4o-mini"),
        schema: GeneratedCaseFieldsSchema,
        temperature: 0.35,
        system: `Sei un medico primario esperto che progetta casi clinici per un simulatore formativo medico-legale (AEQUAN).
Dato un breve testo riassuntivo, genera un profilo di caso completo, coerente e realistico in italiano.

${AI_PROMPT_INJECTION_GUARD}

Regole:
- Tutti i campi sono stringhe (tranne difficulty e sex che seguono lo schema).
- difficulty: EASY / MEDIUM / HARD in base a complessità clinica e medico-legale.
- sex: solo "M" o "F".
- COERENZA NOME–SESSO (TASSATIVA): se sex="M" (Sesso: Maschile) qualsiasi nome proprio nel title/description/context/pastMedicalHistory deve essere maschile italiano (es. Marco, Luca, Paolo). Se sex="F" (Sesso: Femminile) solo nomi femminili (es. Lucia, Laura, Giulia, Anna). Vietato associare nomi maschili a pazienti F e viceversa (es. mai "Luca Rossi" con sex F).
- Nel title usa "Uomo …" con sex M e "Donna …" con sex F, coerenti con i nomi.
- Parametri vitali coerenti con il quadro (es. STEMI → FC e PA realistiche, SpO2 plausibile).
- correctSolution: diagnosi attesa + cenni di gestione / linee guida essenziali (per l'autore del caso, non per il paziente).
- abnormalExamsSummary: elenco sintetico delle alterazioni attese (es. "Troponina ↑, ECG: ST elevazione V2-V4, glicemia borderline").
- Non inventare dettagli assurdi rispetto al brief.
- Non includere markdown o testo fuori dallo schema.`,
        prompt: `Riassunto clinico fornito dall'utente:

"""
${brief}
"""

Compila tutti i campi del caso per il form di creazione.`,
      }),
    );

    logger.info("Case fields generated", {
      userId,
      briefLength: brief.length,
      title: object.title,
      specialty: object.specialty,
    });

    return Response.json({ fields: object });
  } catch (error) {
    logger.error("Failed to generate case fields", { error, userId });
    return Response.json(
      {
        error: "Generazione non riuscita. Riprova tra qualche secondo.",
        code: "GENERATION_FAILED",
      },
      { status: 502 },
    );
  }
}
