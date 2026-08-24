import { NextResponse } from "next/server";
import { getExamMetadataById, updateExamMetadata } from "@/lib/exams/exam-repository";
import { ExamMetadataUpdateSchema } from "@/lib/exams/exam-schemas";
import { isUnauthorizedResponse, requireUserApi } from "@/lib/api-session";
import { requireAdminApi } from "@/lib/require-admin-api";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ExamMetadataUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }

  const existing = await getExamMetadataById(id);
  if (!existing) {
    return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  }

  try {
    const updated = await updateExamMetadata(id, parsed.data);
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update exam" },
      { status: 500 },
    );
  }
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireUserApi();
  if (isUnauthorizedResponse(auth)) return auth;

  const { id } = await context.params;
  const exam = await getExamMetadataById(id);
  if (!exam) {
    return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  }
  return NextResponse.json(exam);
}
