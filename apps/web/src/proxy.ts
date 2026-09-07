import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { API_URL } from "@/constants/api";
import { SESSION_COOKIE } from "@/lib/session";

const PUBLIC_ROUTES = ["/login", "/esqueci-senha"];

// Colaboradores whose onboarding isn't unlocked yet are confined to these
// paths until it is — everything else redirects to /onboarding.
const ONBOARDING_ALWAYS_ALLOWED = ["/onboarding", "/login"];

// Files under /public (login-background.png, favicon.ico, ...) are static
// assets, not app routes — redirecting them to /login when unauthenticated
// breaks anything that references them from the login page itself (the
// image request bounces to /login, which requests the image, forever).
function isStaticAsset(pathname: string): boolean {
  return /\.[^/]+$/.test(pathname);
}

// Decode-only, no signature check — mirrors apps/web/src/lib/session.ts's
// getSession(), not reused directly because that module reads cookies via
// next/headers (server components/route handlers) rather than the
// NextRequest passed to proxy.
function decodeRole(token: string): string | undefined {
  const payload = token.split(".")[1];
  if (!payload) return undefined;
  try {
    const session = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return session.role;
  } catch {
    return undefined;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const hasSession = token !== undefined;
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  if (!hasSession && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (hasSession && isPublicRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (
    token &&
    decodeRole(token) === "colaborador" &&
    !ONBOARDING_ALWAYS_ALLOWED.some((path) => pathname.startsWith(path))
  ) {
    let unlocked = true; // fail-open: an API hiccup (including a hang) must never lock everyone out
    try {
      const res = await fetch(`${API_URL}/onboarding/meu-status`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        unlocked = ((await res.json()) as { unlocked: boolean }).unlocked;
      }
    } catch {
      // network error, non-2xx already handled above, or the 3s timeout fired — stay fail-open
    }

    if (!unlocked) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|documents|sgp-icon.png).*)"],
};
