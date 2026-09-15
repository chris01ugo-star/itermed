import { NextResponse } from "next/server";
import { isUnauthorizedResponse, requireUserApi } from "@/lib/api-session";
import { listMedications } from "@/lib/medications/medication-repository";
import { MedicationListQuerySchema } from "@/lib/medications/medication-schemas";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireUserApi();
  if (isUnauthorizedResponse(auth)) return auth;

  const url = new URL(request.url);
  const parsed = MedicationListQuerySchema.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    take: url.searchParams.get("take") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  try {
    const medications = await listMedications(parsed.data);
    return NextResponse.json({ medications });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load medications" },
      { status: 500 },
    );
  }
}
