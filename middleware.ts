import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { getBetaEmailAllowlistFromEnv, isBetaAuthorized } from "@/lib/beta/access";
import { enforceRateLimit } from "@/lib/security/rate-limit";

/**
 * Same rule as `requireUser` / the login page: in development the bypass is on
 * unless DEV_AUTH_BYPASS is explicitly "false". Requiring the string "true"
 * sent every local visit to /dashboard back to /login.
 */
function isDevAuthBypassEnabled(): boolean {
  if (process.env.NODE_ENV !== "development") return false;
  return process.env.DEV_AUTH_BYPASS !== "false";
}

/** Global Edge cap: 20 requests / minute / client IP for every `/api/*` route. */
const API_IP_RATE_LIMIT = 20;

/** Sign-in UI and NextAuth handlers must never be redirected to themselves. */
function isPublicAuthPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/api/auth" ||
    pathname.startsWith("/api/auth/")
  );
}

function isProtectedPath(pathname: string): boolean {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/case") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/demo")
  );
}

/**
 * Blocks `/api/*` at the Edge (before Node/OpenAI) when an IP exceeds 20 req/min.
 * Identifier is IP-only — `userId` is omitted so spam cannot share another user's quota.
 */
async function enforceApiIpRateLimit(req: NextRequest): Promise<NextResponse | Response | null> {
  if (!req.nextUrl.pathname.startsWith("/api/")) {
    return null;
  }

  const limited = await enforceRateLimit(req, {
    namespace: "edge-api-ip",
    limit: API_IP_RATE_LIMIT,
  });

  if (!limited) return null;

  return new NextResponse(limited.body, {
    status: 429,
    statusText: "Too Many Requests",
    headers: limited.headers,
  });
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicAuthPath(pathname)) {
    return NextResponse.next();
  }

  const rateLimited = await enforceApiIpRateLimit(req);
  if (rateLimited) return rateLimited;

  // Closed beta: public signup is disabled — collect leads on the landing waitlist.
  if (pathname === "/signup" || pathname.startsWith("/signup/")) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("beta", "signup-closed");
    url.hash = "lista-attesa";
    return NextResponse.redirect(url);
  }

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  // Local DEV_AUTH_BYPASS still works via requireUser; allow through in development.
  if (isDevAuthBypassEnabled()) {
    return NextResponse.next();
  }

  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  });

  if (!token?.id && !token?.sub) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  const authorized = isBetaAuthorized({
    role: typeof token.role === "string" ? token.role : null,
    planType: typeof token.planType === "string" ? token.planType : null,
    email: typeof token.email === "string" ? token.email : null,
    allowlist: getBetaEmailAllowlistFromEnv(),
  });

  if (!authorized) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "UNAUTHORIZED_PILOT_EMAIL");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // NextAuth (`/api/auth/*`) stays outside the middleware so session and
    // callback requests are never redirected back to /login.
    "/api/((?!auth(?:/|$)).*)",
    "/dashboard/:path*",
    "/case/:path*",
    "/admin/:path*",
    "/demo/:path*",
    "/signup",
    "/signup/:path*",
  ],
};
