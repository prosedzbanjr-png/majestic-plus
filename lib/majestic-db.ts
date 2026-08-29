import { extractYouTubeId, safeHttpUrl, youtubeThumbnailUrl } from "@/lib/youtube";

export type Production = {
  id: string;
  slug: string;
  title: string;
  description: string;
  genre: string;
  year: number;
  maturity: string;
  runtime: string;
  quality: string;
  cast: string[];
  director: string;
  original: boolean;
  featured: boolean;
  status: "draft" | "published";
  youtube_url: string;
  youtube_id: string;
  thumbnail_url: string | null;
  backdrop_url: string | null;
  created_at: string;
  updated_at: string;
};

const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "") ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export function isSupabaseConfigured() {
  return Boolean(baseUrl && serviceKey);
}

function headers(prefer?: string) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

async function request(path: string, init?: RequestInit) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }

  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...headers(),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase ${response.status}: ${body}`);
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export async function getPublishedProductions(): Promise<Production[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    return (await request(
      "majestic_productions?select=*&status=eq.published&order=featured.desc,created_at.desc",
    )) as Production[];
  } catch {
    return [];
  }
}

export async function getProductionBySlug(slug: string, includeDraft = false): Promise<Production | null> {
  if (!isSupabaseConfigured()) return null;
  const status = includeDraft ? "" : "&status=eq.published";
  try {
    const rows = (await request(
      `majestic_productions?select=*&slug=eq.${encodeURIComponent(slug)}${status}&limit=1`,
    )) as Production[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function adminListProductions(): Promise<Production[]> {
  return (await request("majestic_productions?select=*&order=created_at.desc")) as Production[];
}

export type ProductionInput = {
  title?: unknown;
  slug?: unknown;
  description?: unknown;
  genre?: unknown;
  year?: unknown;
  maturity?: unknown;
  runtime?: unknown;
  quality?: unknown;
  cast?: unknown;
  director?: unknown;
  original?: unknown;
  featured?: unknown;
  status?: unknown;
  youtube_url?: unknown;
  thumbnail_url?: unknown;
  backdrop_url?: unknown;
};

export function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

export function normalizeProductionInput(body: ProductionInput) {
  const title = String(body.title ?? "").trim();
  const youtubeUrl = String(body.youtube_url ?? "").trim();
  const youtubeId = extractYouTubeId(youtubeUrl);

  if (!title) throw new Error("Tytuł jest wymagany.");
  if (!youtubeId) throw new Error("Podaj poprawny link YouTube.");

  const rawCast = Array.isArray(body.cast) ? body.cast : String(body.cast ?? "").split(",");
  const cast = rawCast.map((item) => String(item).trim()).filter(Boolean).slice(0, 40);
  const year = Math.max(1900, Math.min(2100, Number(body.year) || new Date().getFullYear()));
  const thumbnailUrl = safeHttpUrl(String(body.thumbnail_url ?? "")) ?? youtubeThumbnailUrl(youtubeId);
  const backdropUrl = safeHttpUrl(String(body.backdrop_url ?? "")) ?? thumbnailUrl;
  const status = body.status === "published" ? "published" : "draft";

  return {
    title,
    slug: slugify(String(body.slug ?? "") || title),
    description: String(body.description ?? "").trim(),
    genre: String(body.genre ?? "Film").trim() || "Film",
    year,
    maturity: String(body.maturity ?? "16+").trim() || "16+",
    runtime: String(body.runtime ?? "").trim() || "—",
    quality: String(body.quality ?? "4K").trim() || "4K",
    cast,
    director: String(body.director ?? "Richards Majestic Studios").trim() || "Richards Majestic Studios",
    original: Boolean(body.original),
    featured: Boolean(body.featured),
    status,
    youtube_url: youtubeUrl,
    youtube_id: youtubeId,
    thumbnail_url: thumbnailUrl,
    backdrop_url: backdropUrl,
    updated_at: new Date().toISOString(),
  };
}

export async function adminCreateProduction(body: ProductionInput): Promise<Production> {
  const record = normalizeProductionInput(body);
  const rows = (await request("majestic_productions", {
    method: "POST",
    headers: headers("return=representation"),
    body: JSON.stringify(record),
  })) as Production[];
  return rows[0];
}

export async function adminUpdateProduction(id: string, body: ProductionInput): Promise<Production> {
  const record = normalizeProductionInput(body);
  const rows = (await request(`majestic_productions?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: headers("return=representation"),
    body: JSON.stringify(record),
  })) as Production[];
  return rows[0];
}

export async function adminDeleteProduction(id: string) {
  await request(`majestic_productions?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: headers("return=minimal"),
  });
}
