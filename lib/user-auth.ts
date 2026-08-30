import { cookies } from "next/headers";

export type ViewerUser = {
  id: string;
  email?: string;
  user_metadata?: {
    display_name?: string;
    username?: string;
    [key: string]: unknown;
  };
};

export const VIEWER_ACCESS_COOKIE = "majestic_viewer_access";
export const VIEWER_REFRESH_COOKIE = "majestic_viewer_refresh";

const rawBaseUrl = process.env.SUPABASE_URL?.trim().replace(/\/$/, "") ?? "";
const authBaseUrl = rawBaseUrl.replace(/\/rest\/v1$/i, "");
const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim() || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

export function isViewerAuthConfigured() {
  return Boolean(authBaseUrl && publicKey && serviceKey);
}

export function normalizeViewerUsername(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, "")
    .slice(0, 24);
}

export function viewerUsernameEmail(username: string) {
  const normalized = normalizeViewerUsername(username);
  return normalized ? `${normalized}@majestic.invalid` : "";
}

export function viewerCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export async function authRequest(path: string, init?: RequestInit) {
  if (!isViewerAuthConfigured()) throw new Error("Viewer auth is not configured");

  const headers = new Headers(init?.headers);
  headers.set("apikey", publicKey);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`${authBaseUrl}/auth/v1/${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const message = data?.msg || data?.message || data?.error_description || data?.error || "Błąd autoryzacji.";
    throw new Error(String(message));
  }
  return data;
}

export async function adminAuthRequest(path: string, init?: RequestInit) {
  if (!authBaseUrl || !serviceKey) throw new Error("Viewer admin auth is not configured");

  const headers = new Headers(init?.headers);
  headers.set("apikey", serviceKey);
  headers.set("Authorization", `Bearer ${serviceKey}`);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`${authBaseUrl}/auth/v1/admin/${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const message = data?.msg || data?.message || data?.error_description || data?.error || "Błąd autoryzacji.";
    throw new Error(String(message));
  }
  return data;
}

export async function getCurrentViewer(): Promise<ViewerUser | null> {
  if (!isViewerAuthConfigured()) return null;
  const store = await cookies();
  const accessToken = store.get(VIEWER_ACCESS_COOKIE)?.value;
  if (!accessToken) return null;

  try {
    const response = await fetch(`${authBaseUrl}/auth/v1/user`, {
      headers: {
        apikey: publicKey,
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });
    if (!response.ok) return null;
    return (await response.json()) as ViewerUser;
  } catch {
    return null;
  }
}

export function viewerDisplayName(user: ViewerUser | null) {
  const value = String(user?.user_metadata?.display_name ?? "").trim();
  return value || viewerUsername(user) || "Viewer";
}

export function viewerUsername(user: ViewerUser | null) {
  const metadata = normalizeViewerUsername(String(user?.user_metadata?.username ?? ""));
  if (metadata) return metadata;
  const emailPrefix = String(user?.email ?? "").split("@")[0];
  return normalizeViewerUsername(emailPrefix);
}

export function viewerInitials(user: ViewerUser | null) {
  return viewerDisplayName(user)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "RM";
}
