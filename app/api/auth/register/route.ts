import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AI_RATE_LIMITS } from "@/lib/security/ai-rate-limits";
import { enforceRateLimit } from "@/lib/security/rate-limit";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(120).optional(),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({
      message: "Devi accettare Termini di servizio e Privacy Policy.",
    }),
  }),
});

export async function POST(req: Request) {
  const rateLimited = await enforceRateLimit(req, {
    namespace: "api-auth-register",
    limit: AI_RATE_LIMITS.register,
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
    const termsIssue = parsed.error.issues.find((i) => i.path.includes("acceptedTerms"));
    return Response.json(
      {
        error: termsIssue
          ? "Devi accettare Termini di servizio e Privacy Policy."
          : "Dati non validi",
      },
      { status: 400 },
    );
  }

  const email = parsed.data.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return Response.json({ error: "Email già registrata" }, { status: 409 });
  }

  const acceptedAt = new Date();
  const passwordHash = await hash(parsed.data.password, 12);
  await prisma.user.create({
    data: {
      email,
      name: parsed.data.name?.trim() || null,
      passwordHash,
      role: "STUDENT",
      leaderboardOptIn: false,
      termsAcceptedAt: acceptedAt,
      privacyAcceptedAt: acceptedAt,
    },
  });

  return Response.json({ ok: true });
}
