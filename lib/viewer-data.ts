import { getPublishedProductions, type Production } from "@/lib/majestic-db";

const rawBaseUrl = process.env.SUPABASE_URL?.trim().replace(/\/$/, "") ?? "";
const restBaseUrl = rawBaseUrl.endsWith("/rest/v1") ? rawBaseUrl : `${rawBaseUrl}/rest/v1`;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

function isConfigured() {
  return Boolean(rawBaseUrl && serviceKey);
}

async function serviceRequest(path: string, init?: RequestInit) {
  if (!isConfigured()) throw new Error("Supabase is not configured");
  const headers = new Headers(init?.headers);
  headers.set("apikey", serviceKey);
  headers.set("Authorization", `Bearer ${serviceKey}`);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`${restBaseUrl}/${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase ${response.status}: ${text || response.statusText}`);
  }
  return text ? JSON.parse(text) : null;
}

export async function getViewerProfile(userId: string) {
  const rows = (await serviceRequest(
    `majestic_profiles?select=id,display_name,created_at&id=eq.${encodeURIComponent(userId)}&limit=1`,
  )) as Array<{ id: string; display_name: string; created_at: string }>;
  return rows[0] ?? null;
}

export async function getMyListIds(userId: string): Promise<string[]> {
  const rows = (await serviceRequest(
    `majestic_my_list?select=production_id&user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`,
  )) as Array<{ production_id: string }>;
  return rows.map((row) => row.production_id);
}

export async function isOnMyList(userId: string, productionId: string) {
  const rows = (await serviceRequest(
    `majestic_my_list?select=production_id&user_id=eq.${encodeURIComponent(userId)}&production_id=eq.${encodeURIComponent(productionId)}&limit=1`,
  )) as Array<{ production_id: string }>;
  return Boolean(rows[0]);
}

export async function addToMyList(userId: string, productionId: string) {
  await serviceRequest("majestic_my_list?on_conflict=user_id,production_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ user_id: userId, production_id: productionId }),
  });
}

export async function removeFromMyList(userId: string, productionId: string) {
  await serviceRequest(
    `majestic_my_list?user_id=eq.${encodeURIComponent(userId)}&production_id=eq.${encodeURIComponent(productionId)}`,
    { method: "DELETE", headers: { Prefer: "return=minimal" } },
  );
}

export async function getMyListProductions(userId: string): Promise<Production[]> {
  const ids = await getMyListIds(userId);
  if (!ids.length) return [];
  const order = new Map(ids.map((id, index) => [id, index]));
  const published = await getPublishedProductions();
  return published
    .filter((item) => order.has(item.id))
    .sort((a, b) => (order.get(a.id) ?? 9999) - (order.get(b.id) ?? 9999));
}
