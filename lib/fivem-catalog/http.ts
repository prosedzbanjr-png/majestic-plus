import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { CATALOG_LIMITS, CatalogContractError } from "./contract";

const requestBuckets = new Map<string, { startedAt: number; count: number }>();
const SAFE_REQUEST_ID = /^[A-Za-z0-9:_-]{8,64}$/;

const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Resource-Policy": "same-site",
};

export function correlationId(request: NextRequest) {
  const candidate = request.headers.get("x-request-id") ?? "";
  return SAFE_REQUEST_ID.test(candidate) ? candidate : randomUUID();
}

export function boundedInteger(value: string | null, fallback: number, min: number, max: number) {
  if (value === null || value === "") return fallback;
  if (!/^[0-9]{1,3}$/.test(value)) {
    throw new CatalogContractError("SEARCH_INVALID", "Pagination is invalid.");
  }
  const parsed = Number(value);
  if (parsed < min || parsed > max) {
    throw new CatalogContractError("SEARCH_INVALID", "Pagination is invalid.");
  }
  return parsed;
}

export function allowRequest(request: NextRequest, scope: string, limit = 90, windowMs = 60_000) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const key = `${scope}:${forwarded.slice(0, 80)}`;
  const now = Date.now();
  if (requestBuckets.size > 2_000) {
    for (const [bucketKey, bucket] of requestBuckets) {
      if (now - bucket.startedAt >= windowMs) requestBuckets.delete(bucketKey);
    }
    if (requestBuckets.size > 2_000) requestBuckets.clear();
  }
  const current = requestBuckets.get(key);
  if (!current || now - current.startedAt >= windowMs) {
    requestBuckets.set(key, { startedAt: now, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= limit;
}

function headers(cacheControl: string, requestId: string) {
  return {
    ...securityHeaders,
    "Cache-Control": cacheControl,
    "X-Correlation-ID": requestId,
  };
}

export function catalogResponse(data: unknown, requestId: string, cacheControl: string) {
  const body = JSON.stringify({ ok: true, data });
  if (Buffer.byteLength(body, "utf8") > CATALOG_LIMITS.responseBytes) {
    return catalogError(
      new CatalogContractError("CATALOG_INVALID_RESPONSE", "Catalog response exceeded its size limit.", true),
      requestId,
    );
  }
  return new NextResponse(body, {
    status: 200,
    headers: { ...headers(cacheControl, requestId), "Content-Type": "application/json; charset=utf-8" },
  });
}

export function catalogError(error: unknown, requestId: string) {
  const contractError = error instanceof CatalogContractError
    ? error
    : new CatalogContractError("CATALOG_UNAVAILABLE", "Catalog service is temporarily unavailable.", true);
  const status = contractError.code === "SEARCH_INVALID" || contractError.code === "TITLE_INVALID"
    ? 400
    : contractError.code === "CATALOG_UNAVAILABLE"
      ? 503
      : 502;
  return NextResponse.json(
    {
      ok: false,
      error: { code: contractError.code, message: contractError.message, retryable: contractError.retryable },
      correlationId: requestId,
    },
    { status, headers: headers("no-store", requestId) },
  );
}

export function rateLimited(requestId: string) {
  return NextResponse.json(
    {
      ok: false,
      error: { code: "RATE_LIMITED", message: "Too many catalog requests.", retryable: true },
      correlationId: requestId,
    },
    { status: 429, headers: { ...headers("no-store", requestId), "Retry-After": "60" } },
  );
}

export function resetRateLimitsForTests() {
  requestBuckets.clear();
}
