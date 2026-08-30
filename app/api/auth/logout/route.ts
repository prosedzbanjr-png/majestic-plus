import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authRequest, VIEWER_ACCESS_COOKIE, VIEWER_REFRESH_COOKIE, viewerCookieOptions } from "@/lib/user-auth";

export async function POST() {
  const store = await cookies();
  const accessToken = store.get(VIEWER_ACCESS_COOKIE)?.value;

  if (accessToken) {
    try {
      await authRequest("logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch {
      // Local logout should still work even if Supabase already expired the session.
    }
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(VIEWER_ACCESS_COOKIE, "", viewerCookieOptions(0));
  response.cookies.set(VIEWER_REFRESH_COOKIE, "", viewerCookieOptions(0));
  return response;
}
