import { NextResponse } from "next/server";
import {
  authRequest,
  normalizeViewerUsername,
  VIEWER_ACCESS_COOKIE,
  VIEWER_REFRESH_COOKIE,
  viewerCookieOptions,
  viewerUsernameEmail,
} from "@/lib/user-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = normalizeViewerUsername(String(body.username ?? ""));
    const password = String(body.password ?? "");

    if (!username || !password) {
      return NextResponse.json({ error: "Podaj login i hasło." }, { status: 400 });
    }

    const email = viewerUsernameEmail(username);
    const data = await authRequest("token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    const response = NextResponse.json({ ok: true, user: data.user ?? null });
    response.cookies.set(VIEWER_ACCESS_COOKIE, data.access_token, viewerCookieOptions(Number(data.expires_in) || 3600));
    response.cookies.set(VIEWER_REFRESH_COOKIE, data.refresh_token, viewerCookieOptions(60 * 60 * 24 * 30));
    return response;
  } catch {
    return NextResponse.json({ error: "Nieprawidłowy login lub hasło." }, { status: 400 });
  }
}
