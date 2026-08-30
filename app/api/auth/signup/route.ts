import { NextResponse } from "next/server";
import { authRequest, VIEWER_ACCESS_COOKIE, VIEWER_REFRESH_COOKIE, viewerCookieOptions } from "@/lib/user-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const displayName = String(body.display_name ?? "").trim().slice(0, 40);

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: "Podaj poprawny adres e-mail." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Hasło musi mieć minimum 8 znaków." }, { status: 400 });
    }
    if (displayName.length < 2) {
      return NextResponse.json({ error: "Nick musi mieć minimum 2 znaki." }, { status: 400 });
    }

    const data = await authRequest("signup", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        data: { display_name: displayName },
      }),
    });

    const response = NextResponse.json({
      ok: true,
      needsConfirmation: !data.access_token,
      user: data.user ?? null,
    });

    if (data.access_token) {
      response.cookies.set(VIEWER_ACCESS_COOKIE, data.access_token, viewerCookieOptions(Number(data.expires_in) || 3600));
    }
    if (data.refresh_token) {
      response.cookies.set(VIEWER_REFRESH_COOKIE, data.refresh_token, viewerCookieOptions(60 * 60 * 24 * 30));
    }

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nie udało się utworzyć konta." },
      { status: 400 },
    );
  }
}
