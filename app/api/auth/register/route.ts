import { NextResponse } from "next/server";

/** Public signup is closed during beta — use the waitlist on the landing page. */
export async function POST() {
  return NextResponse.json(
    {
      error: "Registrazione chiusa. Iscriviti alla lista d'attesa beta dalla homepage.",
      code: "BETA_SIGNUP_CLOSED",
    },
    { status: 403 },
  );
}
