import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { CatalogContractError } from "./contract";
import {
  allowRequest,
  boundedInteger,
  catalogError,
  catalogResponse,
  correlationId,
  resetRateLimitsForTests,
} from "./http";

function request(headers?: HeadersInit) {
  return new NextRequest("https://majestic.test/api/v1/fivem/catalog", { headers });
}

describe("FiveM catalog HTTP boundary", () => {
  beforeEach(resetRateLimitsForTests);

  it("preserves only a bounded safe correlation ID", () => {
    expect(correlationId(request({ "x-request-id": "catalog:test-123" }))).toBe("catalog:test-123");
    expect(correlationId(request({ "x-request-id": "unsafe value" }))).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("validates pagination strictly", () => {
    expect(boundedInteger("12", 5, 1, 24)).toBe(12);
    expect(() => boundedInteger("100000", 5, 1, 24)).toThrowError(CatalogContractError);
    expect(() => boundedInteger("1.5", 5, 1, 24)).toThrowError(CatalogContractError);
  });

  it("sets explicit public cache and baseline security headers", async () => {
    const response = catalogResponse({ version: "1", rows: [] }, "catalog:test-123", "public, s-maxage=60");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, s-maxage=60");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.json()).toMatchObject({ ok: true, data: { version: "1" } });
  });

  it("rejects oversized response bodies", async () => {
    const response = catalogResponse({ value: "x".repeat(300_000) }, "catalog:test-123", "public");
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ ok: false, error: { code: "CATALOG_INVALID_RESPONSE" } });
  });

  it("rate-limits repeated requests by scope and forwarded address", () => {
    const input = request({ "x-forwarded-for": "203.0.113.20" });
    expect(allowRequest(input, "test", 2)).toBe(true);
    expect(allowRequest(input, "test", 2)).toBe(true);
    expect(allowRequest(input, "test", 2)).toBe(false);
  });

  it("does not expose raw provider errors", async () => {
    const response = catalogError(new Error("PostgREST SQL detail"), "catalog:test-123");
    const text = await response.text();
    expect(response.status).toBe(503);
    expect(text).toContain("CATALOG_UNAVAILABLE");
    expect(text).not.toContain("PostgREST");
  });
});
