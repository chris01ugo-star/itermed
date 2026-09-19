import { NextResponse } from "next/server";
import {
  PILOT_ACCESS_DENIED_MESSAGE,
  UNAUTHORIZED_PILOT_EMAIL_CODE,
} from "@/lib/pilot-whitelist";

/** Public signup is closed — only the university pilot whitelist may access Aequan. */
export async function POST() {
  return NextResponse.json(
    {
      error: PILOT_ACCESS_DENIED_MESSAGE,
      code: UNAUTHORIZED_PILOT_EMAIL_CODE,
    },
    { status: 403 },
  );
}
