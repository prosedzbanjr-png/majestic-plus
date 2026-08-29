import { getTitle, rows as staticRows, titles as staticTitles, type Title } from "@/lib/catalog";
import { getProductionBySlug, getPublishedProductions, type Production } from "@/lib/majestic-db";

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
  youtubeUrl?: string;
  youtubeId?: string;
  thumbnailUrl?: string | null;
  backdropUrl?: string | null;
};

export function staticToView(item: Title): ViewTitle {
  return {
    ...item,
    original: Boolean(item.original),
    featured: item.slug === "vinewood-nights",
  };
}

export function productionToView(item: Production): ViewTitle {
  return {
    id: item.id,
    slug: item.slug,
    title: item.title,
    meta: `${item.genre} · ${item.year}`,
    year: String(item.year),
    maturity: item.maturity,
    runtime: item.runtime,
    quality: item.quality,
    match: "NEW",
    genre: item.genre,
    description: item.description,
    cast: item.cast ?? [],
    director: item.director,
    original: item.original,
    featured: item.featured,
    posterClass: "",
    youtubeUrl: item.youtube_url,
    youtubeId: item.youtube_id,
    thumbnailUrl: item.thumbnail_url,
    backdropUrl: item.backdrop_url,
  };
}

export async function getViewTitle(slug: string): Promise<ViewTitle | null> {
  const production = await getProductionBySlug(slug);
  if (production) return productionToView(production);
  const fallback = getTitle(slug);
  return fallback ? staticToView(fallback) : null;
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
  if (!db.length) {
    return { featured: staticFeatured, rows: fallbackRows };
  }

  const featured = db.find((item) => item.featured) ?? db[0] ?? staticFeatured;
  const originals = db.filter((item) => item.original);

  return {
    featured,
    rows: [
      {
        title: "Popularne teraz",
        items: fill(db.slice(0, 6), fallbackRows[0]?.items ?? []),
      },
      {
        title: "Majestic+ Originals",
        items: fill(originals.slice(0, 6), fallbackRows[1]?.items ?? []),
      },
      {
        title: "Ostatnio dodane",
        items: fill(db.slice(0, 6), fallbackRows[2]?.items ?? []),
      },
    ],
  };
}

export async function getSearchContent() {
  const db = (await getPublishedProductions()).map(productionToView);
  const fallback = staticTitles.map(staticToView);
  const seen = new Set(db.map((item) => item.slug));
  return [...db, ...fallback.filter((item) => !seen.has(item.slug))];
}
