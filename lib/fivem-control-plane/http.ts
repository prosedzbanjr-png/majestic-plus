import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  ControlPlaneError,
  MAX_REQUEST_BODY_BYTES,
  safeSecretEqual,
} from "./contract";

const SAFE_REQUEST_ID = /^[A-Za-z0-9:_-]{8,64}$/;
const rateBuckets = new Map<string, { startedAt: number; count: number }>();

const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store",
};

export function correlationId(request: Request) {
  const candidate = request.headers.get("x-request-id") ?? "";
  return SAFE_REQUEST_ID.test(candidate) ? candidate : randomUUID();
}

export function allowControlRequest(
  request: Request,
  scope: string,
  limit = 60,
  windowMs = 60_000,
  identity?: string,
) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const key = `${scope}:${String(identity || forwarded).slice(0, 120)}`;
  const now = Date.now();
  if (rateBuckets.size > 2_000) {
    for (const [bucketKey, bucket] of rateBuckets) {
      if (now - bucket.startedAt >= windowMs) rateBuckets.delete(bucketKey);
    }
    if (rateBuckets.size > 2_000) rateBuckets.clear();
  }
  const current = rateBuckets.get(key);
  if (!current || now - current.startedAt >= windowMs) {
    rateBuckets.set(key, { startedAt: now, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= limit;
}

export function assertMachineAuth(request: Request) {
  const expected = process.env.MAJESTIC_FIVEM_API_KEY?.trim() ?? "";
  if (!expected) {
    throw new ControlPlaneError("INTERNAL_ERROR", "Machine authentication is not configured.", 500, true);
  }
  const header = request.headers.get("authorization") ?? "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!supplied || !safeSecretEqual(expected, supplied)) {
    throw new ControlPlaneError("UNAUTHORIZED", "Unauthorized.", 401);
  }
}

export async function parseBoundedJson(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BODY_BYTES) {
    throw new ControlPlaneError("INVALID_REQUEST", "Request body is too large.", 413);
  }
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > MAX_REQUEST_BODY_BYTES) {
    throw new ControlPlaneError("INVALID_REQUEST", "Request body is too large.", 413);
  }
  try {
    const parsed = text ? JSON.parse(text) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("invalid body");
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new ControlPlaneError("INVALID_REQUEST", "Request body must be valid JSON.", 400);
  }
}

export function controlResponse(body: Record<string, unknown>, requestId: string, status = 200) {
  return NextResponse.json(
    { ...body, correlationId: requestId },
    { status, headers: { ...securityHeaders, "X-Correlation-ID": requestId } },
  );
}

export function controlError(error: unknown, requestId: string) {
  const safe = error instanceof ControlPlaneError
    ? error
    : new ControlPlaneError("INTERNAL_ERROR", "Control plane is temporarily unavailable.", 500, true);
  return NextResponse.json(
    {
      version: "1",
      ok: false,
      error: { code: safe.code, message: safe.message, retryable: safe.retryable },
      correlationId: requestId,
    },
    { status: safe.status, headers: { ...securityHeaders, "X-Correlation-ID": requestId } },
  );
}

export async function machinePost(
  request: NextRequest,
  scope: string,
  handler: (body: Record<string, unknown>, requestId: string) => Promise<Record<string, unknown>>,
) {
  const requestId = correlationId(request);
  try {
    assertMachineAuth(request);
    if (!allowControlRequest(request, scope, 120)) {
      throw new ControlPlaneError("RATE_LIMITED", "Too many requests.", 429, true);
    }
    const body = await parseBoundedJson(request);
    return controlResponse(await handler(body, requestId), requestId);
  } catch (error) {
    if (!(error instanceof ControlPlaneError)) {
      console.error(`[majestic-plus] ${scope} failed correlation=${requestId}`);
    }
    return controlError(error, requestId);
  }
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  try {
    if (new URL(origin).origin !== new URL(request.url).origin) {
      throw new ControlPlaneError("UNAUTHORIZED", "Unauthorized.", 403);
    }
  } catch (error) {
    if (error instanceof ControlPlaneError) throw error;
    throw new ControlPlaneError("UNAUTHORIZED", "Unauthorized.", 403);
  }
}

export function resetControlRateLimitsForTests() {
  rateBuckets.clear();
}
