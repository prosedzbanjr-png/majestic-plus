import { getTitle, rows as staticRows, titles as staticTitles, type Title } from "@/lib/catalog";
import {
  getEpisodesForProduction,
  getProductionBySlug,
  getPublishedProductions,
  type Episode,
  type Production,
} from "@/lib/majestic-db";

export type ViewTitle = {
  id?: string;
  slug: string;
  title: string;
  meta: string;
  year: string;
  maturity: string;
  runtime: string;
  quality: string;
  match: string;
  genre: string;
  description: string;
  cast: string[];
  director: string;
  original: boolean;
  featured: boolean;
  posterClass: string;
  contentType: "film" | "series";
  homeSection: "popular" | "originals" | "latest";
  displayOrder: number;
  youtubeUrl?: string | null;
  youtubeId?: string | null;
  thumbnailUrl?: string | null;
  backdropUrl?: string | null;
};

export function staticToView(item: Title): ViewTitle {
  return {
    ...item,
    original: Boolean(item.original),
    featured: item.slug === "vinewood-nights",
    contentType: "film",
    homeSection: item.original ? "originals" : "popular",
    displayOrder: 999,
  };
}

export function productionToView(item: Production): ViewTitle {
  return {
    id: item.id,
    slug: item.slug,
    title: item.title,
    meta: `${item.content_type === "series" ? "Serial" : item.genre} · ${item.year}`,
    year: String(item.year),
    maturity: item.maturity,
    runtime: item.runtime,
    quality: item.quality,
    match: "NEW",
    genre: item.genre,
    description: item.description,
    cast: item.cast_members ?? [],
    director: item.director,
    original: item.original,
    featured: item.featured,
    posterClass: "",
    contentType: item.content_type ?? "film",
    homeSection: item.home_section ?? "latest",
    displayOrder: item.display_order ?? 0,
    youtubeUrl: item.youtube_url,
    youtubeId: item.youtube_id,
    thumbnailUrl: item.thumbnail_url,
    backdropUrl: item.backdrop_url,
  };
}

export async function getViewTitle(slug: string, includeDraft = false): Promise<ViewTitle | null> {
  const production = await getProductionBySlug(slug, includeDraft);
  if (production) return productionToView(production);
  const fallback = getTitle(slug);
  return fallback ? staticToView(fallback) : null;
}

export async function getViewEpisodes(item: ViewTitle, includeDraft = false): Promise<Episode[]> {
  if (!item.id || item.contentType !== "series") return [];
  return getEpisodesForProduction(item.id, includeDraft);
}

function fill(items: ViewTitle[], fallbacks: ViewTitle[], limit = 6) {
  const seen = new Set(items.map((item) => item.slug));
  const result = [...items];
  for (const item of fallbacks) {
    if (result.length >= limit) break;
    if (!seen.has(item.slug)) {
      result.push(item);
      seen.add(item.slug);
    }
  }
  return result.slice(0, limit);
}

export async function getHomeContent() {
  const db = (await getPublishedProductions()).map(productionToView);
  const fallbackBySlug = new Map(staticTitles.map((item) => [item.slug, staticToView(item)]));
  const fallbackRows = staticRows.map((row) => ({
    title: row.title,
    items: row.slugs.map((slug) => fallbackBySlug.get(slug)!).filter(Boolean),
  }));

  const staticFeatured = fallbackBySlug.get("vinewood-nights")!;
  if (!db.length) return { featured: staticFeatured, rows: fallbackRows };

  const featured = db.find((item) => item.featured) ?? db[0] ?? staticFeatured;
  const bySection = (section: ViewTitle["homeSection"]) =>
    db.filter((item) => item.homeSection === section).sort((a, b) => a.displayOrder - b.displayOrder);

  return {
    featured,
    rows: [
      { title: "Popularne teraz", items: fill(bySection("popular"), fallbackRows[0]?.items ?? []) },
      { title: "Majestic+ Originals", items: fill(bySection("originals"), fallbackRows[1]?.items ?? []) },
      { title: "Ostatnio dodane", items: fill(bySection("latest"), fallbackRows[2]?.items ?? []) },
    ],
  };
}

export async function getSearchContent() {
  const db = (await getPublishedProductions()).map(productionToView);
  const fallback = staticTitles.map(staticToView);
  const seen = new Set(db.map((item) => item.slug));
  return [...db, ...fallback.filter((item) => !seen.has(item.slug))];
}
