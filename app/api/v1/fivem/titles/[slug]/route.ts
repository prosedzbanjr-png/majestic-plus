import { NextRequest } from "next/server";
import { allowRequest, catalogError, catalogResponse, correlationId, rateLimited } from "@/lib/fivem-catalog/http";
import { loadTitleDetails } from "@/lib/fivem-catalog/service";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const requestId = correlationId(request);
  if (!allowRequest(request, "catalog-title")) return rateLimited(requestId);
  try {
    const details = await loadTitleDetails((await params).slug);
    if (!details) {
      return Response.json(
        {
          ok: false,
          error: { code: "TITLE_NOT_FOUND", message: "Title was not found.", retryable: false },
          correlationId: requestId,
        },
        {
          status: 404,
          headers: {
            "Cache-Control": "public, max-age=30, s-maxage=60",
            "X-Content-Type-Options": "nosniff",
            "X-Correlation-ID": requestId,
          },
        },
      );
    }
    return catalogResponse(
      details,
      requestId,
      "public, max-age=60, s-maxage=120, stale-while-revalidate=300",
    );
  } catch (error) {
    console.error(`[majestic-plus] catalog.title failed correlation=${requestId}`);
    return catalogError(error, requestId);
  }
}
