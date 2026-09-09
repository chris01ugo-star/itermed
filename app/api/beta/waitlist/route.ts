import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AI_RATE_LIMITS } from "@/lib/security/ai-rate-limits";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email().max(200),
  name: z.string().trim().max(120).optional(),
  roleHint: z.string().trim().max(80).optional(),
});

export async function POST(req: Request) {
  const rateLimited = await enforceRateLimit(req, {
    namespace: "api-beta-waitlist",
    limit: AI_RATE_LIMITS.register ?? 5,
  });
  if (rateLimited) return rateLimited;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "Body non valido" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Inserisci un'email valida." }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const name = parsed.data.name?.trim() || null;
  const roleHint = parsed.data.roleHint?.trim() || null;

  try {
    await prisma.betaWaitlistEntry.upsert({
      where: { email },
      create: {
        email,
        name,
        roleHint,
        source: "landing",
      },
      update: {
        ...(name ? { name } : {}),
        ...(roleHint ? { roleHint } : {}),
      },
    });
  } catch (err) {
    console.error("[beta-waitlist] persist failed", err);
    return Response.json(
      { error: "Impossibile salvare la richiesta. Riprova tra poco." },
      { status: 503 },
    );
  }

  return Response.json({ ok: true });
}
