import { NextRequest } from "next/server";
import { catalogError, catalogResponse, correlationId, allowRequest, rateLimited } from "@/lib/fivem-catalog/http";
import { loadCatalogHome } from "@/lib/fivem-catalog/service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const requestId = correlationId(request);
  if (!allowRequest(request, "catalog-home")) return rateLimited(requestId);
  try {
    return catalogResponse(
      await loadCatalogHome(),
      requestId,
      "public, max-age=30, s-maxage=60, stale-while-revalidate=300",
    );
  } catch (error) {
    console.error(`[majestic-plus] catalog.home failed correlation=${requestId}`);
    return catalogError(error, requestId);
  }
}
