import { NextResponse } from "next/server";
import { createExamMetadata, listExamMetadata, listDistinctExamCategories } from "@/lib/exams/exam-repository";
import { ExamListQuerySchema, ExamMetadataCreateSchema } from "@/lib/exams/exam-schemas";
import { isUnauthorizedResponse, requireUserApi } from "@/lib/api-session";
import { requireAdminApi } from "@/lib/require-admin-api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireUserApi();
  if (isUnauthorizedResponse(auth)) return auth;

  const url = new URL(request.url);
  const parsed = ExamListQuerySchema.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  try {
    const [exams, categories] = await Promise.all([
      listExamMetadata(parsed.data),
      listDistinctExamCategories(),
    ]);

    return NextResponse.json({ exams, categories });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load exams" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ExamMetadataCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }

  try {
    const created = await createExamMetadata(parsed.data);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create exam" },
      { status: 500 },
    );
  }
}
