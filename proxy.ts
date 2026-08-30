import { NextRequest, NextResponse } from "next/server";

const ACCESS_COOKIE = "majestic_viewer_access";
const REFRESH_COOKIE = "majestic_viewer_refresh";

function authConfig() {
  const raw = process.env.SUPABASE_URL?.trim().replace(/\/$/, "") ?? "";
  const baseUrl = raw.replace(/\/rest\/v1$/i, "");
  const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim() || "";
  return { baseUrl, publicKey };
}

function expiresSoon(token: string) {
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return true;
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded)) as { exp?: number };
    if (!payload.exp) return true;
    return payload.exp * 1000 - Date.now() < 5 * 60 * 1000;
  } catch {
    return true;
  }
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export async function proxy(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value ?? "";
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value ?? "";

  if (!refreshToken || (accessToken && !expiresSoon(accessToken))) {
    return NextResponse.next();
  }

  const { baseUrl, publicKey } = authConfig();
  if (!baseUrl || !publicKey) return NextResponse.next();

  try {
    const refreshResponse = await fetch(`${baseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        apikey: publicKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    });

    if (!refreshResponse.ok) {
      const response = NextResponse.next();
      if (refreshResponse.status === 400 || refreshResponse.status === 401) {
        response.cookies.set(ACCESS_COOKIE, "", cookieOptions(0));
        response.cookies.set(REFRESH_COOKIE, "", cookieOptions(0));
      }
      return response;
    }

    const session = await refreshResponse.json();
    const wasExpiredOrMissing = !accessToken || expiresSoon(accessToken) && (() => {
      try {
        const payloadPart = accessToken.split(".")[1];
        if (!payloadPart) return true;
        const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
        const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
        const payload = JSON.parse(atob(padded)) as { exp?: number };
        return !payload.exp || payload.exp * 1000 <= Date.now();
      } catch {
        return true;
      }
    })();

    const response = wasExpiredOrMissing
      ? NextResponse.redirect(request.nextUrl)
      : NextResponse.next();

    if (session.access_token) {
      response.cookies.set(ACCESS_COOKIE, session.access_token, cookieOptions(Number(session.expires_in) || 3600));
    }
    if (session.refresh_token) {
      response.cookies.set(REFRESH_COOKIE, session.refresh_token, cookieOptions(60 * 60 * 24 * 30));
    }
    return response;
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
