import { supabaseBaseUrl, supabaseServiceKey } from "@/lib/majestic-db";
import {
  AUTH_SCAN_MAX_PAGES,
  AUTH_SCAN_PAGE_SIZE,
  ControlPlaneError,
} from "./contract";

export type AdminViewerUser = {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

const restBaseUrl = supabaseBaseUrl ? `${supabaseBaseUrl}/rest/v1` : "";
const authAdminBaseUrl = supabaseBaseUrl ? `${supabaseBaseUrl}/auth/v1/admin` : "";
const DEFAULT_TIMEOUT_MS = 7_000;

function ensureConfigured() {
  if (!supabaseBaseUrl || !supabaseServiceKey) {
    throw new ControlPlaneError("INTERNAL_ERROR", "Supabase is not configured.", 500, true);
  }
}

function serviceHeaders(init?: HeadersInit) {
  const headers = new Headers(init);
  headers.set("apikey", supabaseServiceKey);
  headers.set("Authorization", `Bearer ${supabaseServiceKey}`);
  headers.set("Content-Type", "application/json");
  return headers;
}

async function timedFetch(url: string, init?: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      headers: serviceHeaders(init?.headers),
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase ${response.status}`);
  }
  return (text ? JSON.parse(text) : null) as T;
}

export async function controlRestRequest<T>(path: string, init?: RequestInit): Promise<T> {
  ensureConfigured();
  const response = await timedFetch(`${restBaseUrl}/${path.replace(/^\/+/, "")}`, init);
  return parseResponse<T>(response);
}

export async function controlAuthAdminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  ensureConfigured();
  const response = await timedFetch(`${authAdminBaseUrl}/${path.replace(/^\/+/, "")}`, init);
  return parseResponse<T>(response);
}

export async function listAuthUsersBounded() {
  const users: AdminViewerUser[] = [];
  for (let page = 1; page <= AUTH_SCAN_MAX_PAGES; page += 1) {
    const data = await controlAuthAdminRequest<{
      users?: AdminViewerUser[];
      next_page?: number | null;
      last_page?: number;
    }>(`users?page=${page}&per_page=${AUTH_SCAN_PAGE_SIZE}`);
    const pageUsers = Array.isArray(data?.users) ? data.users : [];
    users.push(...pageUsers);
    if (pageUsers.length < AUTH_SCAN_PAGE_SIZE) break;
    if (typeof data.last_page === "number" && page >= data.last_page) break;
    if (data.next_page === null) break;
  }
  return users;
}

export async function getAdminViewerUser(userId: string) {
  return controlAuthAdminRequest<AdminViewerUser>(`users/${encodeURIComponent(userId)}`);
}

export async function updateAdminAppMetadata(userId: string, appMetadata: Record<string, unknown>) {
  return controlAuthAdminRequest<AdminViewerUser>(`users/${encodeURIComponent(userId)}`, {
    method: "PUT",
    body: JSON.stringify({ app_metadata: appMetadata }),
  });
}
