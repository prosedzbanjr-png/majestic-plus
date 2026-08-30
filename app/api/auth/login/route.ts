import { NextResponse } from "next/server";
import { authRequest, VIEWER_ACCESS_COOKIE, VIEWER_REFRESH_COOKIE, viewerCookieOptions } from "@/lib/user-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!email || !password) {
      return NextResponse.json({ error: "Podaj e-mail i hasło." }, { status: 400 });
    }

    const data = await authRequest("token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    const response = NextResponse.json({ ok: true, user: data.user ?? null });
    response.cookies.set(VIEWER_ACCESS_COOKIE, data.access_token, viewerCookieOptions(Number(data.expires_in) || 3600));
    response.cookies.set(VIEWER_REFRESH_COOKIE, data.refresh_token, viewerCookieOptions(60 * 60 * 24 * 30));
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nie udało się zalogować." },
      { status: 400 },
    );
  }
}
