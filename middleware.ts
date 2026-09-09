import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { getBetaEmailAllowlistFromEnv, isBetaAuthorized } from "@/lib/beta/access";

const isDev = process.env.NODE_ENV === "development";

function isProtectedPath(pathname: string): boolean {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/case") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/demo")
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

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
  if (isDev && process.env.DEV_AUTH_BYPASS === "true") {
    return NextResponse.next();
  }

  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  });

  if (!token?.id && !token?.sub) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
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
    url.pathname = "/";
    url.searchParams.set("beta", "pending");
    url.hash = "lista-attesa";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/case/:path*", "/admin/:path*", "/demo/:path*", "/signup", "/signup/:path*"],
};
