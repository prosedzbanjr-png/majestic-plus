import { describe, expect, it } from "vitest";
import { CatalogContractError } from "./contract";
import { loadCatalogHome, loadTitleDetails, type CatalogDataSource } from "./service";

const emptySource: CatalogDataSource = {
  async listPublished() { return []; },
  async findPublishedBySlug() { return null; },
  async listPublishedEpisodes() { return []; },
};

describe("FiveM catalog service errors", () => {
  it("returns null for an unknown published title", async () => {
    await expect(loadTitleDetails("missing-title", emptySource)).resolves.toBeNull();
  });

  it("normalizes database failures without exposing provider text", async () => {
    const failing: CatalogDataSource = {
      ...emptySource,
      async listPublished() { throw new Error("Supabase secret diagnostic"); },
    };
    const error = await loadCatalogHome(failing).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(CatalogContractError);
    expect(error).toMatchObject({ code: "CATALOG_UNAVAILABLE", retryable: true });
    expect(String((error as Error).message)).not.toContain("Supabase");
  });
});
