import { NextResponse } from "next/server";
import { STUDIO_COOKIE, studioCookieValue, verifyStudioPassword } from "@/lib/studio-auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const password = String(body.password ?? "");

  if (!verifyStudioPassword(password)) {
    return NextResponse.json({ error: "Nieprawidłowe hasło." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(STUDIO_COOKIE, studioCookieValue(), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}
