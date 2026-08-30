import { NextResponse } from "next/server";
import {
  adminAuthRequest,
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
    const displayName = String(body.display_name ?? "").trim().slice(0, 40);

    if (username.length < 3) {
      return NextResponse.json({ error: "Login musi mieć minimum 3 znaki." }, { status: 400 });
    }
    if (!/^[a-z0-9_.-]+$/.test(username)) {
      return NextResponse.json({ error: "Login może zawierać tylko litery, cyfry, kropkę, myślnik i _." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Hasło musi mieć minimum 8 znaków." }, { status: 400 });
    }
    if (displayName.length < 2) {
      return NextResponse.json({ error: "Nick musi mieć minimum 2 znaki." }, { status: 400 });
    }

    const email = viewerUsernameEmail(username);

    await adminAuthRequest("users", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          username,
          display_name: displayName,
        },
      }),
    });

    const data = await authRequest("token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    const response = NextResponse.json({ ok: true, user: data.user ?? null });
    response.cookies.set(VIEWER_ACCESS_COOKIE, data.access_token, viewerCookieOptions(Number(data.expires_in) || 3600));
    response.cookies.set(VIEWER_REFRESH_COOKIE, data.refresh_token, viewerCookieOptions(60 * 60 * 24 * 30));
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nie udało się utworzyć konta.";
    const friendly = /already|registered|exists|duplicate/i.test(message)
      ? "Ten login jest już zajęty."
      : message;
    return NextResponse.json({ error: friendly }, { status: 400 });
  }
}
