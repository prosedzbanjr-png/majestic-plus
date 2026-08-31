import {
  getPublishedCatalogEpisodeRows,
  getPublishedCatalogRowBySlug,
  getPublishedCatalogRows,
} from "@/lib/majestic-db";
import {
  buildHome,
  buildTitleDetails,
  CATALOG_LIMITS,
  CatalogContractError,
  normalizeSlug,
  searchCatalog,
} from "./contract";

export type CatalogDataSource = {
  listPublished(limit: number): Promise<unknown[]>;
  findPublishedBySlug(slug: string): Promise<unknown | null>;
  listPublishedEpisodes(productionId: string, limit: number): Promise<unknown[]>;
};

const databaseSource: CatalogDataSource = {
  listPublished: getPublishedCatalogRows,
  findPublishedBySlug: getPublishedCatalogRowBySlug,
  listPublishedEpisodes: getPublishedCatalogEpisodeRows,
};

async function safeDatabaseCall<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof CatalogContractError) throw error;
    throw new CatalogContractError("CATALOG_UNAVAILABLE", "Catalog service is temporarily unavailable.", true);
  }
}

export async function loadCatalogHome(source = databaseSource) {
  return safeDatabaseCall(async () => buildHome(await source.listPublished(CATALOG_LIMITS.databaseTitles)));
}

export async function loadCatalogSearch(query: string, limit: number, source = databaseSource) {
  return safeDatabaseCall(async () =>
    searchCatalog(await source.listPublished(CATALOG_LIMITS.databaseTitles), query, limit),
  );
}

export async function loadTitleDetails(rawSlug: string, source = databaseSource) {
  const slug = normalizeSlug(rawSlug);
  return safeDatabaseCall(async () => {
    const production = await source.findPublishedBySlug(slug);
    if (!production) return null;
    const record = production as Record<string, unknown>;
    const productionId = typeof record.id === "string" ? record.id : "";
    const episodes = record.content_type === "series"
      ? await source.listPublishedEpisodes(productionId, CATALOG_LIMITS.episodes)
      : [];
    return buildTitleDetails(production, episodes);
  });
}
