import { NextRequest } from "next/server";
import { CATALOG_LIMITS } from "@/lib/fivem-catalog/contract";
import {
  allowRequest,
  boundedInteger,
  catalogError,
  catalogResponse,
  correlationId,
  rateLimited,
} from "@/lib/fivem-catalog/http";
import { loadCatalogSearch } from "@/lib/fivem-catalog/service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const requestId = correlationId(request);
  if (!allowRequest(request, "catalog-search", 60)) return rateLimited(requestId);
  try {
    const query = request.nextUrl.searchParams.get("q") ?? "";
    const limit = boundedInteger(
      request.nextUrl.searchParams.get("limit"),
      12,
      1,
      CATALOG_LIMITS.searchResults,
    );
    return catalogResponse(
      await loadCatalogSearch(query, limit),
      requestId,
      "public, max-age=10, s-maxage=30, stale-while-revalidate=60",
    );
  } catch (error) {
    console.error(`[majestic-plus] catalog.search failed correlation=${requestId}`);
    return catalogError(error, requestId);
  }
}
