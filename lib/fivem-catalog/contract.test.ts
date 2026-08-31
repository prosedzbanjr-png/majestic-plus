import { describe, expect, it } from "vitest";
import {
  buildHome,
  buildTitleDetails,
  CatalogContractError,
  normalizeSearchQuery,
  normalizeSlug,
  searchCatalog,
} from "./contract";

function production(overrides: Record<string, unknown> = {}) {
  return {
    id: "74b2d4a8-b53a-421f-8566-03c10ae75354",
    slug: "zolty-szlak",
    title: "Żółty szlak",
    description: "Polska produkcja Majestic.",
    genre: "Dramat / Thriller",
    year: 2026,
    maturity: "16+",
    runtime: "1h 42m",
    original: true,
    featured: true,
    content_type: "film",
    home_section: "popular",
    display_order: 1,
    thumbnail_url: "https://i.ytimg.com/vi/example/maxresdefault.jpg",
    backdrop_url: null,
    ...overrides,
  };
}

describe("FiveM catalog DTO contract", () => {
  it("maps real production fields into bounded version 1 home DTOs", () => {
    const home = buildHome([production()]);
    expect(home.version).toBe("1");
    expect(home.featured).toMatchObject({ slug: "zolty-szlak", type: "movie", genres: ["Dramat", "Thriller"] });
    expect(home.rows).toHaveLength(3);
    expect(home.rows[0].items).toHaveLength(1);
  });

  it("represents an empty database honestly without static fallback", () => {
    const home = buildHome([]);
    expect(home.featured).toBeUndefined();
    expect(home.rows.every((row) => row.items.length === 0)).toBe(true);
  });

  it("searches Unicode and Polish text server-side", () => {
    expect(searchCatalog([production()], "żółty", 5).items[0]?.slug).toBe("zolty-szlak");
    expect(searchCatalog([production()], "DRAMAT", 5).items).toHaveLength(1);
  });

  it("rejects empty and overlong search input", () => {
    expect(() => normalizeSearchQuery(" ")).toThrowError(CatalogContractError);
    expect(() => normalizeSearchQuery("x".repeat(81))).toThrowError(/1 to 80/);
  });

  it("rejects invalid pagination and slugs", () => {
    expect(() => searchCatalog([production()], "szlak", 25)).toThrowError(CatalogContractError);
    expect(() => normalizeSlug("../admin")).toThrowError(CatalogContractError);
  });

  it("fails closed on malformed database values", () => {
    expect(() => buildHome([production({ title: 42 })])).toThrowError(CatalogContractError);
    expect(() => buildHome([production({ thumbnail_url: "http://example.test/image.jpg" })])).toThrowError(/artwork URL/);
  });

  it("groups published series episode metadata by season without media URLs", () => {
    const details = buildTitleDetails(
      production({ content_type: "series", runtime: "8 odcinków" }),
      [{
        id: "episode-1",
        production_id: "74b2d4a8-b53a-421f-8566-03c10ae75354",
        season_number: 1,
        episode_number: 1,
        title: "Początek",
        description: "Pierwszy odcinek.",
        runtime: "42 min",
        thumbnail_url: "https://i.ytimg.com/vi/example/hqdefault.jpg",
        display_order: 0,
      }],
    );
    expect(details.seasons?.[0]).toMatchObject({ number: 1, episodes: [{ episodeNumber: 1, durationSeconds: 2520 }] });
    expect(JSON.stringify(details)).not.toContain("youtube");
  });
});
