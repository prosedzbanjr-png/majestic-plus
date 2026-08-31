export const CATALOG_CONTRACT_VERSION = "1" as const;
export const CATALOG_LIMITS = {
  databaseTitles: 72,
  homeRows: 3,
  cardsPerRow: 12,
  searchQuery: 80,
  searchResults: 24,
  description: 1200,
  episodeDescription: 420,
  episodes: 120,
  responseBytes: 256 * 1024,
} as const;

export type CatalogCard = {
  id: string;
  slug: string;
  title: string;
  type: "movie" | "series";
  year?: number;
  ageRating?: string;
  genres: string[];
  posterUrl?: string;
  backdropUrl?: string;
  badge?: string;
};

export type CatalogFeature = CatalogCard & {
  description: string;
};

export type CatalogHome = {
  version: typeof CATALOG_CONTRACT_VERSION;
  featured?: CatalogFeature;
  rows: Array<{ key: "popular" | "originals" | "latest"; title: string; items: CatalogCard[] }>;
};

export type CatalogEpisode = {
  id: string;
  episodeNumber: number;
  title: string;
  description?: string;
  durationSeconds?: number;
  artworkUrl?: string;
};

export type CatalogSeason = {
  number: number;
  episodes: CatalogEpisode[];
};

export type TitleDetails = CatalogFeature & {
  version: typeof CATALOG_CONTRACT_VERSION;
  durationSeconds?: number;
  featured: boolean;
  seasons?: CatalogSeason[];
};

export class CatalogContractError extends Error {
  constructor(
    public readonly code:
      | "CATALOG_UNAVAILABLE"
      | "CATALOG_INVALID_RESPONSE"
      | "SEARCH_INVALID"
      | "TITLE_INVALID",
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
  }
}

type NormalizedProduction = CatalogFeature & {
  featured: boolean;
  homeSection: "popular" | "originals" | "latest";
  displayOrder: number;
  durationSeconds?: number;
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CatalogContractError("CATALOG_INVALID_RESPONSE", "Catalog data is malformed.", true);
  }
  return value as Record<string, unknown>;
}

function boundedString(value: unknown, min: number, max: number): string {
  if (typeof value !== "string") {
    throw new CatalogContractError("CATALOG_INVALID_RESPONSE", "Catalog data is malformed.", true);
  }
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw new CatalogContractError("CATALOG_INVALID_RESPONSE", "Catalog data is malformed.", true);
  }
  return normalized;
}

function optionalHttpsUrl(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const candidate = boundedString(value, 1, 2048);
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error("invalid");
    return parsed.toString();
  } catch {
    throw new CatalogContractError("CATALOG_INVALID_RESPONSE", "Catalog artwork URL is invalid.", true);
  }
}

function positiveInteger(value: unknown, min: number, max: number): number {
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) {
    throw new CatalogContractError("CATALOG_INVALID_RESPONSE", "Catalog number is invalid.", true);
  }
  return Number(value);
}

function durationSeconds(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim().toLocaleLowerCase("pl");
  const hours = /([0-9]{1,2})\s*h/.exec(text);
  const minutes = /([0-9]{1,3})\s*(?:m|min)/.exec(text);
  if (!hours && !minutes) return undefined;
  const total = Number(hours?.[1] ?? 0) * 3600 + Number(minutes?.[1] ?? 0) * 60;
  return total > 0 && total <= 24 * 3600 ? total : undefined;
}

function genres(value: unknown): string[] {
  const source = boundedString(value, 1, 160);
  const items = source
    .split(/[,/|]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);
  if (!items.length || items.some((item) => item.length > 40)) {
    throw new CatalogContractError("CATALOG_INVALID_RESPONSE", "Catalog genres are invalid.", true);
  }
  return items;
}

export function normalizeProduction(value: unknown): NormalizedProduction {
  const item = record(value);
  const contentType = item.content_type === "series" ? "series" : item.content_type === "film" ? "movie" : null;
  if (!contentType) throw new CatalogContractError("CATALOG_INVALID_RESPONSE", "Catalog type is invalid.", true);
  const homeSection = ["popular", "originals", "latest"].includes(String(item.home_section))
    ? (item.home_section as NormalizedProduction["homeSection"])
    : null;
  if (!homeSection) throw new CatalogContractError("CATALOG_INVALID_RESPONSE", "Catalog section is invalid.", true);

  const original = item.original === true;
  return {
    id: boundedString(item.id, 1, 64),
    slug: boundedString(item.slug, 1, 90),
    title: boundedString(item.title, 1, 160),
    description: boundedString(item.description ?? "", 0, CATALOG_LIMITS.description),
    type: contentType,
    year: positiveInteger(item.year, 1900, 2100),
    ageRating: boundedString(item.maturity ?? "", 0, 20) || undefined,
    genres: genres(item.genre),
    posterUrl: optionalHttpsUrl(item.thumbnail_url),
    backdropUrl: optionalHttpsUrl(item.backdrop_url),
    badge: original ? "Majestic+ Original" : undefined,
    featured: item.featured === true,
    homeSection,
    displayOrder: Number.isInteger(item.display_order) ? Math.max(0, Math.min(9999, Number(item.display_order))) : 0,
    durationSeconds: durationSeconds(item.runtime),
  };
}

function card(item: NormalizedProduction): CatalogCard {
  return {
    id: item.id,
    slug: item.slug,
    title: item.title,
    type: item.type,
    year: item.year,
    ageRating: item.ageRating,
    genres: item.genres,
    posterUrl: item.posterUrl,
    backdropUrl: item.backdropUrl,
    badge: item.badge,
  };
}

export function buildHome(rows: unknown[]): CatalogHome {
  if (!Array.isArray(rows) || rows.length > CATALOG_LIMITS.databaseTitles) {
    throw new CatalogContractError("CATALOG_INVALID_RESPONSE", "Catalog response is not bounded.", true);
  }
  const items = rows.map(normalizeProduction).sort((a, b) => a.displayOrder - b.displayOrder);
  const definitions = [
    ["popular", "Popularne teraz"],
    ["originals", "Majestic+ Originals"],
    ["latest", "Ostatnio dodane"],
  ] as const;
  const featured = items.find((item) => item.featured) ?? items[0];
  return {
    version: CATALOG_CONTRACT_VERSION,
    featured: featured ? { ...card(featured), description: featured.description } : undefined,
    rows: definitions.map(([key, title]) => ({
      key,
      title,
      items: items.filter((item) => item.homeSection === key).slice(0, CATALOG_LIMITS.cardsPerRow).map(card),
    })),
  };
}

export function normalizeSearchQuery(value: string): string {
  const query = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (!query || query.length > CATALOG_LIMITS.searchQuery) {
    throw new CatalogContractError("SEARCH_INVALID", "Search query must contain 1 to 80 characters.");
  }
  return query;
}

export function searchCatalog(rows: unknown[], rawQuery: string, limit: number = CATALOG_LIMITS.searchResults) {
  const query = normalizeSearchQuery(rawQuery).toLocaleLowerCase("pl");
  if (!Number.isInteger(limit) || limit < 1 || limit > CATALOG_LIMITS.searchResults) {
    throw new CatalogContractError("SEARCH_INVALID", "Search limit is invalid.");
  }
  const items = rows.map(normalizeProduction);
  const results = items
    .filter((item) => `${item.title} ${item.genres.join(" ")} ${item.description} ${item.year}`.toLocaleLowerCase("pl").includes(query))
    .slice(0, limit)
    .map(card);
  return { version: CATALOG_CONTRACT_VERSION, query: rawQuery.normalize("NFKC").trim(), items: results };
}

export function normalizeSlug(value: string): string {
  const slug = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,89}$/.test(slug)) {
    throw new CatalogContractError("TITLE_INVALID", "Title slug is invalid.");
  }
  return slug;
}

function normalizeEpisode(value: unknown): CatalogEpisode & { seasonNumber: number; displayOrder: number } {
  const item = record(value);
  return {
    id: boundedString(item.id, 1, 64),
    seasonNumber: positiveInteger(item.season_number, 1, 99),
    episodeNumber: positiveInteger(item.episode_number, 1, 999),
    title: boundedString(item.title, 1, 160),
    description: boundedString(item.description ?? "", 0, CATALOG_LIMITS.episodeDescription) || undefined,
    durationSeconds: durationSeconds(item.runtime),
    artworkUrl: optionalHttpsUrl(item.thumbnail_url),
    displayOrder: Number.isInteger(item.display_order) ? Math.max(0, Math.min(9999, Number(item.display_order))) : 0,
  };
}

export function buildTitleDetails(production: unknown, episodeRows: unknown[]): TitleDetails {
  const item = normalizeProduction(production);
  if (!Array.isArray(episodeRows) || episodeRows.length > CATALOG_LIMITS.episodes) {
    throw new CatalogContractError("CATALOG_INVALID_RESPONSE", "Episode response is not bounded.", true);
  }
  const seasons = new Map<number, Array<CatalogEpisode & { displayOrder: number }>>();
  if (item.type === "series") {
    for (const episode of episodeRows.map(normalizeEpisode)) {
      const list = seasons.get(episode.seasonNumber) ?? [];
      list.push(episode);
      seasons.set(episode.seasonNumber, list);
    }
  }
  return {
    version: CATALOG_CONTRACT_VERSION,
    ...card(item),
    description: item.description,
    durationSeconds: item.durationSeconds,
    featured: item.featured,
    seasons: item.type === "series"
      ? [...seasons.entries()]
          .sort(([a], [b]) => a - b)
          .map(([number, episodes]) => ({
            number,
            episodes: episodes
              .sort((a, b) => a.displayOrder - b.displayOrder || a.episodeNumber - b.episodeNumber)
              .map((episode) => ({
                id: episode.id,
                episodeNumber: episode.episodeNumber,
                title: episode.title,
                description: episode.description,
                durationSeconds: episode.durationSeconds,
                artworkUrl: episode.artworkUrl,
              })),
          }))
      : undefined,
  };
}
