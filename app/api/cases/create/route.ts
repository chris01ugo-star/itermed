import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/api-session";
import { AdvancedCaseCreateSchema } from "@/lib/cases/case-creator-schemas";
import { requireTeacherApi } from "@/lib/cases/require-teacher-api";
import { prisma } from "@/lib/prisma";
import { AI_RATE_LIMITS } from "@/lib/security/ai-rate-limits";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

function buildPatientPrompt(input: {
  demographics?: { age?: unknown; sex?: string | null; context?: string | null };
  description: string;
  patientPrompt?: string | null;
}): string {
  if (input.patientPrompt?.trim()) return input.patientPrompt.trim();

  const age = input.demographics?.age != null ? String(input.demographics.age) : "";
  const sex =
    input.demographics?.sex === "F"
      ? "Femmina"
      : input.demographics?.sex === "M"
        ? "Maschio"
        : "";
  const ctx = input.demographics?.context?.trim() ?? "";

  return [age ? `${age} anni` : "", sex, ctx, input.description.trim()]
    .filter(Boolean)
    .join(". ");
}

export async function POST(request: Request) {
  const denied = await requireTeacherApi();
  if (denied) return denied;

  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimited = await enforceRateLimit(request, {
    namespace: "api-cases-create",
    limit: AI_RATE_LIMITS.casesCreate,
    userId,
  });
  if (rateLimited) return rateLimited;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = AdvancedCaseCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  const canPublishGlobal = user?.role === "ADMIN";

  const baselineExamFindings = {
    demographics: data.demographics ?? {},
    vitals: data.vitals ?? {},
    advancedExams: { notes: null, values: {} },
  };

  const patientPrompt = buildPatientPrompt({
    demographics: data.demographics,
    description: data.description,
    patientPrompt: data.patientPrompt,
  });

  const created = await prisma.clinicalCase.create({
    data: {
      title: data.title.trim(),
      description: data.description.trim(),
      specialty: data.specialty?.trim() || null,
      difficulty: data.difficulty,
      isActive: true,
      isGlobal: canPublishGlobal && Boolean(data.isGlobal),
      pastMedicalHistory: data.pastMedicalHistory?.trim() || null,
      correctSolution: data.correctSolution?.trim() || null,
      estimatedDurationMinutes: data.timeLimitMinutes ?? null,
      timeLimitMinutes: data.timeLimitMinutes ?? null,
      goldStandardPath: data.goldStandardPath,
      examLatencies: data.examLatencies ?? {},
      patientDeteriorationThreshold: data.patientDeteriorationThreshold ?? null,
      baselineExamFindings,
      createdById: userId,
      nodes: {
        create: [
          {
            order: 1,
            type: "HISTORY",
            content: { casePrompt: patientPrompt },
          },
        ],
      },
    },
    select: { id: true, title: true },
  });

  return NextResponse.json(created, { status: 201 });
}
