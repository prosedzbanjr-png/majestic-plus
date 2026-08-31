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
  cast_members: string[];
  director: string;
  original: boolean;
  featured: boolean;
  status: "draft" | "published";
  content_type: "film" | "series";
  home_section: "popular" | "originals" | "latest";
  display_order: number;
  youtube_url: string | null;
  youtube_id: string | null;
  thumbnail_url: string | null;
  backdrop_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Episode = {
  id: string;
  production_id: string;
  season_number: number;
  episode_number: number;
  title: string;
  description: string;
  runtime: string;
  youtube_url: string;
  youtube_id: string;
  thumbnail_url: string | null;
  status: "draft" | "published";
  display_order: number;
  created_at: string;
  updated_at: string;
};

const rawBaseUrl = process.env.SUPABASE_URL?.trim().replace(/\/$/, "") ?? "";
export const supabaseBaseUrl = rawBaseUrl.replace(/\/rest\/v1$/i, "");
export const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
const restBaseUrl = supabaseBaseUrl ? `${supabaseBaseUrl}/rest/v1` : "";

export function isSupabaseConfigured() {
  return Boolean(supabaseBaseUrl && supabaseServiceKey);
}

function requestHeaders(initHeaders?: HeadersInit) {
  const headers = new Headers(initHeaders);
  headers.set("apikey", supabaseServiceKey);
  headers.set("Authorization", `Bearer ${supabaseServiceKey}`);
  headers.set("Content-Type", "application/json");
  return headers;
}

async function request(path: string, init?: RequestInit) {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured");

  const response = await fetch(`${restBaseUrl}/${path}`, {
    ...init,
    headers: requestHeaders(init?.headers),
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

const catalogProductionSelect = [
  "id",
  "slug",
  "title",
  "description",
  "genre",
  "year",
  "maturity",
  "runtime",
  "original",
  "featured",
  "content_type",
  "home_section",
  "display_order",
  "thumbnail_url",
  "backdrop_url",
].join(",");

const catalogEpisodeSelect = [
  "id",
  "production_id",
  "season_number",
  "episode_number",
  "title",
  "description",
  "runtime",
  "thumbnail_url",
  "display_order",
].join(",");

/** Strict, narrow catalog reads used by the public versioned API. */
export async function getPublishedCatalogRows(limit: number): Promise<unknown[]> {
  return (await request(
    `majestic_productions?select=${catalogProductionSelect}&status=eq.published&order=featured.desc,display_order.asc,created_at.desc&limit=${limit}`,
  )) as unknown[];
}

export async function getPublishedCatalogRowBySlug(slug: string): Promise<unknown | null> {
  const rows = (await request(
    `majestic_productions?select=${catalogProductionSelect}&slug=eq.${encodeURIComponent(slug)}&status=eq.published&limit=1`,
  )) as unknown[];
  return rows[0] ?? null;
}

export async function getPublishedCatalogEpisodeRows(productionId: string, limit: number): Promise<unknown[]> {
  return (await request(
    `majestic_episodes?select=${catalogEpisodeSelect}&production_id=eq.${encodeURIComponent(productionId)}&status=eq.published&order=season_number.asc,display_order.asc,episode_number.asc&limit=${limit}`,
  )) as unknown[];
}

export async function getPublishedProductions(): Promise<Production[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    return (await request(
      "majestic_productions?select=*&status=eq.published&order=featured.desc,display_order.asc,created_at.desc",
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
  return (await request("majestic_productions?select=*&order=display_order.asc,created_at.desc")) as Production[];
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
  content_type?: unknown;
  home_section?: unknown;
  display_order?: unknown;
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
  const contentType = body.content_type === "series" ? "series" : "film";
  const youtubeUrl = String(body.youtube_url ?? "").trim();
  const youtubeId = youtubeUrl ? extractYouTubeId(youtubeUrl) : null;

  if (!title) throw new Error("Tytuł jest wymagany.");
  if (contentType === "film" && !youtubeId) throw new Error("Film wymaga poprawnego linku YouTube.");
  if (youtubeUrl && !youtubeId) throw new Error("Podaj poprawny link YouTube.");

  const rawCast = Array.isArray(body.cast) ? body.cast : String(body.cast ?? "").split(",");
  const castMembers = rawCast.map((item) => String(item).trim()).filter(Boolean).slice(0, 40);
  const year = Math.max(1900, Math.min(2100, Number(body.year) || new Date().getFullYear()));
  const fallbackThumb = youtubeId ? youtubeThumbnailUrl(youtubeId) : null;
  const thumbnailUrl = safeHttpUrl(String(body.thumbnail_url ?? "")) ?? fallbackThumb;
  const backdropUrl = safeHttpUrl(String(body.backdrop_url ?? "")) ?? thumbnailUrl;
  const status = body.status === "published" ? "published" : "draft";
  const slug = slugify(String(body.slug ?? "") || title);
  const homeSection = ["popular", "originals", "latest"].includes(String(body.home_section))
    ? String(body.home_section)
    : "latest";
  const displayOrder = Math.max(0, Math.min(9999, Number(body.display_order) || 0));

  if (!slug) throw new Error("Nie udało się utworzyć poprawnego adresu produkcji.");

  return {
    title,
    slug,
    description: String(body.description ?? "").trim(),
    genre: String(body.genre ?? (contentType === "series" ? "Serial" : "Film")).trim() || "Film",
    year,
    maturity: String(body.maturity ?? "16+").trim() || "16+",
    runtime: String(body.runtime ?? "").trim() || (contentType === "series" ? "Serial" : "—"),
    quality: String(body.quality ?? "4K").trim() || "4K",
    cast_members: castMembers,
    director: String(body.director ?? "Richards Majestic Studios").trim() || "Richards Majestic Studios",
    original: Boolean(body.original),
    featured: Boolean(body.featured),
    status,
    content_type: contentType,
    home_section: homeSection,
    display_order: displayOrder,
    youtube_url: youtubeUrl || null,
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
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(record),
  })) as Production[];
  return rows[0];
}

export async function adminUpdateProduction(id: string, body: ProductionInput): Promise<Production> {
  const record = normalizeProductionInput(body);
  const rows = (await request(`majestic_productions?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(record),
  })) as Production[];
  return rows[0];
}

export async function adminDeleteProduction(id: string) {
  await request(`majestic_productions?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
}

export type EpisodeInput = {
  production_id?: unknown;
  season_number?: unknown;
  episode_number?: unknown;
  title?: unknown;
  description?: unknown;
  runtime?: unknown;
  youtube_url?: unknown;
  thumbnail_url?: unknown;
  status?: unknown;
  display_order?: unknown;
};

function normalizeEpisodeInput(body: EpisodeInput) {
  const productionId = String(body.production_id ?? "").trim();
  const title = String(body.title ?? "").trim();
  const youtubeUrl = String(body.youtube_url ?? "").trim();
  const youtubeId = extractYouTubeId(youtubeUrl);
  if (!productionId) throw new Error("Wybierz serial.");
  if (!title) throw new Error("Tytuł odcinka jest wymagany.");
  if (!youtubeId) throw new Error("Odcinek wymaga poprawnego linku YouTube.");

  return {
    production_id: productionId,
    season_number: Math.max(1, Number(body.season_number) || 1),
    episode_number: Math.max(1, Number(body.episode_number) || 1),
    title,
    description: String(body.description ?? "").trim(),
    runtime: String(body.runtime ?? "").trim() || "—",
    youtube_url: youtubeUrl,
    youtube_id: youtubeId,
    thumbnail_url: safeHttpUrl(String(body.thumbnail_url ?? "")) ?? youtubeThumbnailUrl(youtubeId),
    status: body.status === "published" ? "published" : "draft",
    display_order: Math.max(0, Math.min(9999, Number(body.display_order) || 0)),
    updated_at: new Date().toISOString(),
  };
}

export async function getEpisodesForProduction(productionId: string, includeDraft = false): Promise<Episode[]> {
  if (!isSupabaseConfigured()) return [];
  const status = includeDraft ? "" : "&status=eq.published";
  try {
    return (await request(
      `majestic_episodes?select=*&production_id=eq.${encodeURIComponent(productionId)}${status}&order=season_number.asc,display_order.asc,episode_number.asc`,
    )) as Episode[];
  } catch {
    return [];
  }
}

export async function getEpisodeById(id: string, includeDraft = false): Promise<Episode | null> {
  if (!isSupabaseConfigured()) return null;
  const status = includeDraft ? "" : "&status=eq.published";
  try {
    const rows = (await request(
      `majestic_episodes?select=*&id=eq.${encodeURIComponent(id)}${status}&limit=1`,
    )) as Episode[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function adminListEpisodes(productionId: string): Promise<Episode[]> {
  return (await request(
    `majestic_episodes?select=*&production_id=eq.${encodeURIComponent(productionId)}&order=season_number.asc,display_order.asc,episode_number.asc`,
  )) as Episode[];
}

export async function adminCreateEpisode(body: EpisodeInput): Promise<Episode> {
  const record = normalizeEpisodeInput(body);
  const rows = (await request("majestic_episodes", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(record),
  })) as Episode[];
  return rows[0];
}

export async function adminUpdateEpisode(id: string, body: EpisodeInput): Promise<Episode> {
  const record = normalizeEpisodeInput(body);
  const rows = (await request(`majestic_episodes?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(record),
  })) as Episode[];
  return rows[0];
}

export async function adminDeleteEpisode(id: string) {
  await request(`majestic_episodes?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
}
