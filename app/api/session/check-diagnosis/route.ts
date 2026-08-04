import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import { getSessionUserId } from "../../../../lib/api-session";
import { authorizeSimulationAction } from "../../../../lib/access";
import { sanitizeLiveSessionId } from "@/lib/simulator/session-id";
import { isDevAuthBypass } from "../../../../lib/require-user";
import { sanitizeForExternalAI } from "@/lib/security/sanitize-for-ai";
import { AI_RATE_LIMITS } from "@/lib/security/ai-rate-limits";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { withOpenAIRetry } from "@/lib/ai/openai-retry";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth-options";

export const runtime = "nodejs";

const bodySchema = z.object({
  caseId: z.string().min(1),
  sessionId: z.string().optional(),
  diagnosisText: z.string().min(1),
});

const verdictSchema = z.object({
  isCorrect: z.boolean(),
  rationale: z.string(),
  expectedCondition: z.string().optional(),
});

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function isRequestingUserAdmin(): Promise<boolean> {
  if (isDevAuthBypass()) return true;

  const session = await getServerSession(authOptions);
  return session?.user?.role === "ADMIN";
}

function stripExpectedConditionIfNeeded<T extends { expectedCondition?: string }>(
  payload: T,
  includeExpected: boolean,
): T {
  if (includeExpected) return payload;
  const { expectedCondition: _omit, ...rest } = payload;
  return rest as T;
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rateLimited = await enforceRateLimit(req, {
    namespace: "api-check-diagnosis",
    limit: AI_RATE_LIMITS.checkDiagnosis,
    userId,
  });
  if (rateLimited) return rateLimited;

  const json = await req.json();
  const { caseId, sessionId, diagnosisText } = bodySchema.parse(json);

  const access = await authorizeSimulationAction({ userId, sessionId, caseId });
  if (!access.ok) {
    return new Response(JSON.stringify({ error: access.error, code: access.code }), {
      status: access.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const liveSessionId = sanitizeLiveSessionId(access.liveSessionId);

  const session = liveSessionId
    ? await prisma.caseSession.findUnique({
        where: { id: liveSessionId },
        include: { case: true },
      })
    : null;

  const clinicalCase = session?.case
    ? {
        title: session.case.title,
        description: session.case.description,
        correctSolution: (session.case as any).correctSolution as string | null,
      }
    : await prisma.clinicalCase.findUnique({
        where: { id: caseId },
        select: { correctSolution: true, title: true, description: true },
      });

  if (!clinicalCase) {
    return new Response(JSON.stringify({ error: "Case not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const expectedRaw =
    (session as any)?.currentTargetCondition ??
    (session as any)?.variantSolution ??
    (clinicalCase.correctSolution ?? "");
  const expected = String(expectedRaw ?? "").trim();
  const userDx = sanitizeForExternalAI(diagnosisText.trim());
  const includeExpectedCondition = await isRequestingUserAdmin();

  // Heuristic first: if the user diagnosis is a clear substring (or vice versa), treat as correct.
  // This prevents obvious correct diagnoses (e.g. "appendicite") from being marked wrong.
  const nExpected = normalizeText(expected);
  const nUser = normalizeText(userDx);
  if (nExpected && nUser) {
    if (nExpected.includes(nUser) || nUser.includes(nExpected)) {
      return new Response(
        JSON.stringify(
          stripExpectedConditionIfNeeded(
            {
              isCorrect: true,
              rationale: "Match testuale evidente tra diagnosi e soluzione attesa.",
              expectedCondition: expected ? expected : undefined,
            },
            includeExpectedCondition,
          ),
        ),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  // If there is no expected solution saved, we cannot judge deterministically.
  if (!expected) {
    return new Response(
      JSON.stringify({
        isCorrect: true,
        rationale:
          "Nessuna soluzione corretta salvata per il caso: per ora consideriamo la diagnosi valida.",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  const system = `
Sei un valutatore clinico. Devi stabilire se la diagnosi finale dell'utente corrisponde alla SOLUZIONE CORRETTA ATTESA del caso.
Rispondi SOLO JSON con:
- isCorrect: true/false
- rationale: 1 frase in italiano (molto breve)
- expectedCondition: 1 riga con la patologia/diagnosi corretta (anche sintetica)

Regole:
- Se la diagnosi è equivalente (sinonimi comuni) -> true.
- Se è chiaramente diversa/errata -> false.
- Se è troppo generica e non identifica il problema principale -> false.
`.trim();

  const { object } = await withOpenAIRetry(() =>
    generateObject({
      model: openai("gpt-4o-mini"),
      system,
      schema: verdictSchema,
      prompt: `
CASO:
Titolo: ${clinicalCase.title}
Descrizione: ${clinicalCase.description}

SOLUZIONE CORRETTA ATTESA:
"""${expected}"""

DIAGNOSI INSERITA DALL'UTENTE:
"""${userDx}"""
`.trim(),
    }),
  );

  return new Response(
    JSON.stringify(stripExpectedConditionIfNeeded(object, includeExpectedCondition)),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

