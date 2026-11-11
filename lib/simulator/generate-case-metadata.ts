import { generateObject } from "ai";
import { z } from "zod";
import { MODEL_GPT_6_LUNA, openAIObjectCall } from "@/lib/ai/models";
import { asOpenAIStrictSchema } from "@/lib/ai/strict-schema";

export type AiGeneratedCaseProfile = {
  title: string;
  specialty: string;
  age: string;
  sex: "M" | "F" | "";
  context: string;
  description: string;
  pastHistory: string;
  correctSolution: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
};

/** Chiavi allineate ai `name` del form creazione caso (esame obiettivo). */
export type AiGeneratedObjective = {
  vitals_fc: string;
  vitals_pa: string;
  vitals_spo2: string;
  vitals_temp: string;
  vitals_fr: string;
  thorax_cardiac: string;
  thorax_lung: string;
  abdomen_inspection: string;
  abdomen_palpation: string;
  abdomen_percussion: string;
  neuro_pupils: string;
  neuro_gcs: string;
  neuro_deficits: string;
};

const EMPTY_OBJECTIVE: AiGeneratedObjective = {
  vitals_fc: "",
  vitals_pa: "",
  vitals_spo2: "",
  vitals_temp: "",
  vitals_fr: "",
  thorax_cardiac: "",
  thorax_lung: "",
  abdomen_inspection: "",
  abdomen_palpation: "",
  abdomen_percussion: "",
  neuro_pupils: "",
  neuro_gcs: "",
  neuro_deficits: "",
};

function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function normalizeDifficulty(v: unknown): "EASY" | "MEDIUM" | "HARD" {
  const s = str(v).toUpperCase();
  if (s === "EASY" || s === "HARD" || s === "MEDIUM") return s;
  return "MEDIUM";
}

function normalizeSex(v: unknown): "M" | "F" | "" {
  const s = str(v).toUpperCase();
  if (s === "M" || s === "MALE" || s === "MASCHIO") return "M";
  if (s === "F" || s === "FEMALE" || s === "FEMMINA") return "F";
  return "";
}

export function parseCaseAndObjectiveJson(raw: string): {
  caseProfile: AiGeneratedCaseProfile;
  objective: AiGeneratedObjective;
} | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const root = parsed as Record<string, unknown>;
  const c = root.case;
  const o = root.objective;
  if (!c || typeof c !== "object" || Array.isArray(c)) return null;
  const co = c as Record<string, unknown>;
  const caseProfile: AiGeneratedCaseProfile = {
    title: str(co.title),
    specialty: str(co.specialty),
    age: str(co.age),
    sex: normalizeSex(co.sex),
    context: str(co.context),
    description: str(co.description),
    pastHistory: str(co.pastHistory),
    correctSolution: str(co.correctSolution),
    difficulty: normalizeDifficulty(co.difficulty),
  };

  const objective = { ...EMPTY_OBJECTIVE };
  if (o && typeof o === "object" && !Array.isArray(o)) {
    const oo = o as Record<string, unknown>;
    for (const k of Object.keys(EMPTY_OBJECTIVE) as (keyof AiGeneratedObjective)[]) {
      objective[k] = str(oo[k]);
    }
  }

  return { caseProfile, objective };
}

const objectiveSchema = z
  .object({
    vitals_fc: z.string(),
    vitals_pa: z.string(),
    vitals_spo2: z.string(),
    vitals_temp: z.string(),
    vitals_fr: z.string(),
    thorax_cardiac: z.string(),
    thorax_lung: z.string(),
    abdomen_inspection: z.string(),
    abdomen_palpation: z.string(),
    abdomen_percussion: z.string(),
    neuro_pupils: z.string(),
    neuro_gcs: z.string(),
    neuro_deficits: z.string(),
  })
  .strict();

const caseAndObjectiveSchema = z
  .object({
    case: z
      .object({
        title: z.string(),
        specialty: z.string(),
        age: z.string(),
        sex: z.enum(["M", "F"]),
        context: z.string(),
        description: z.string(),
        pastHistory: z.string(),
        correctSolution: z.string(),
        difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
      })
      .strict(),
    objective: objectiveSchema,
  })
  .strict();

type MetadataInput = {
  caseDescription: string;
  diagnosis: string;
  age: string;
  sex: string;
};

export async function generateCaseMetadataAndObjective(
  input: MetadataInput,
): Promise<{ caseProfile: AiGeneratedCaseProfile; objective: AiGeneratedObjective } | null> {
  const { caseDescription, diagnosis, age, sex } = input;

  const systemPrompt = `Sei un medico primario esperto. In base al contesto clinico fornito, compila il profilo del caso e l'esame obiettivo.

Regole:
- Tutti i campi sono stringhe in italiano, sintetici ma clinici.
- sex è solo "M" o "F". difficulty è solo EASY, MEDIUM o HARD.
- Coerenza interna tra parametri vitali, torace, addome, neuro e il quadro descritto.
- COERENZA NOME–SESSO (TASSATIVA): se sex="M" (Sesso: Maschile) ogni nome proprio nel title/description/context/pastHistory deve essere maschile; se sex="F" (Sesso: Femminile) solo nomi femminili. Mai nomi maschili con sex F (es. vietato "Luca Rossi" + F) e viceversa.
- Title: "Uomo …" solo con sex M; "Donna …" solo con sex F.
- NON inventare dettagli assurdi rispetto al contesto.`;

  const userContent = `Contesto disponibile:

Descrizione narrativa del caso (può essere vuota se non fornita):
"""
${caseDescription || "(non fornita)"}
"""

Diagnosi / soluzione indicata dall'autore (può essere vuota):
"""
${diagnosis || "(non fornita)"}
"""

Dati anagrafici già noti nel modulo (integrali se coerenti, altrimenti correggi solo se il contesto è chiaro): età: ${age || "non specificata"}, sesso: ${sex || "non specificato"}.

Genera il profilo caso e l'esame obiettivo richiesti dallo schema.`;

  const { object } = await generateObject({
    ...openAIObjectCall(MODEL_GPT_6_LUNA),
    schema: asOpenAIStrictSchema(caseAndObjectiveSchema),
    system: systemPrompt,
    prompt: userContent,
  });

  return {
    caseProfile: object.case,
    objective: object.objective,
  };
}
