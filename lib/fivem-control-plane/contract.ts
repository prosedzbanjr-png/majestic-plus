import { createHmac, createHash, timingSafeEqual } from "node:crypto";

export const CONTROL_PLANE_VERSION = "1" as const;
export const PURCHASE_MARKER_PREFIX = "__MPLUS_FIVEM_PURCHASE_V1__:";
export const MAX_REQUEST_BODY_BYTES = 16 * 1024;
export const AUTH_SCAN_MAX_PAGES = 20;
export const AUTH_SCAN_PAGE_SIZE = 100;
const PAIR_BUCKET_MS = 150_000;

export type ControlPlaneErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_REQUEST"
  | "RATE_LIMITED"
  | "ACCOUNT_NOT_LINKED"
  | "PHONE_CHANGED"
  | "ACCOUNT_ALREADY_LINKED"
  | "IDENTITY_ALREADY_LINKED"
  | "PHONE_ALREADY_LINKED"
  | "LINK_INVALID"
  | "PLAN_NOT_FOUND"
  | "SUBSCRIPTION_REQUIRED"
  | "OPERATION_NOT_FOUND"
  | "OPERATION_CANCELLED"
  | "OPERATION_ALREADY_COMMITTED"
  | "PURCHASE_CONFLICT"
  | "CONTENT_UNAVAILABLE"
  | "PLAYBACK_UNAVAILABLE"
  | "INTERNAL_ERROR";

export class ControlPlaneError extends Error {
  constructor(
    public readonly code: ControlPlaneErrorCode,
    message: string,
    public readonly status = 400,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "ControlPlaneError";
  }
}

export type FiveMLinkMetadata = {
  version: 1;
  realm: string;
  phone: string;
  subject_hash: string;
  linked_at: string;
};

export type PurchaseMarkerState = "prepared" | "applying" | "cancelled";

export type PurchaseMarker = {
  state: PurchaseMarkerState;
  planCode: string;
  billingDays: number;
  preparedAt: string;
  basePeriodEnd?: string;
  appliedPeriodEnd?: string;
};

function hmacHex(secret: string, value: string) {
  return createHmac("sha256", secret).update(value, "utf8").digest("hex");
}

function stableEightDigits(hex: string) {
  const value = BigInt(`0x${hex.slice(0, 16)}`) % BigInt(100_000_000);
  return value.toString().padStart(8, "0");
}

export function normalizePhone(value: unknown) {
  const phone = String(value ?? "").trim().replace(/\D+/g, "");
  if (phone.length < 3 || phone.length > 20) {
    throw new ControlPlaneError("INVALID_REQUEST", "Phone number is invalid.", 400);
  }
  return phone;
}

export function maskPhone(phone: string) {
  const normalized = phone.replace(/\D+/g, "");
  const tail = normalized.slice(-4);
  return `${"*".repeat(Math.max(3, normalized.length - tail.length))}${tail}`;
}

export function normalizeRealm(value: unknown) {
  const realm = String(value ?? "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{1,63}$/.test(realm)) {
    throw new ControlPlaneError("INTERNAL_ERROR", "FiveM realm is not configured.", 500, true);
  }
  return realm;
}

export function validateSubject(value: unknown) {
  const subject = String(value ?? "").trim();
  if (!subject || subject.length > 512) {
    throw new ControlPlaneError("INVALID_REQUEST", "Subject is invalid.", 400);
  }
  return subject;
}

export function validateUsername(value: unknown) {
  const username = String(value ?? "").trim().toLowerCase();
  if (username.length < 3 || username.length > 24 || !/^[a-z0-9_.-]+$/.test(username)) {
    throw new ControlPlaneError("INVALID_REQUEST", "Username is invalid.", 400);
  }
  return username;
}

export function validatePairCode(value: unknown) {
  const code = String(value ?? "").trim();
  if (!/^\d{8}$/.test(code)) {
    throw new ControlPlaneError("LINK_INVALID", "Pairing code is invalid or expired.", 400);
  }
  return code;
}

export function validatePlanCode(value: unknown) {
  const code = String(value ?? "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{0,31}$/.test(code)) {
    throw new ControlPlaneError("INVALID_REQUEST", "Plan code is invalid.", 400);
  }
  return code;
}

export function validateOperationId(value: unknown) {
  const operationId = String(value ?? "").trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(operationId)) {
    throw new ControlPlaneError("INVALID_REQUEST", "operationId must be a UUID.", 400);
  }
  return operationId;
}

export function validateCancelReason(value: unknown) {
  const reason = String(value ?? "").trim();
  if (!new Set(["DEBIT_FAILED", "COMPENSATED", "ABORTED"]).has(reason)) {
    throw new ControlPlaneError("INVALID_REQUEST", "Cancel reason is invalid.", 400);
  }
  return reason as "DEBIT_FAILED" | "COMPENSATED" | "ABORTED";
}

export function deriveSubjectHash(secret: string, realm: string, subject: string) {
  return hmacHex(secret, `subject:v1|${realm}|${subject}`);
}

export function pairingCodeForBucket(secret: string, userId: string, realm: string, phone: string, bucket: number) {
  const payload = ["pair:v1", userId, realm, phone, String(bucket)].join("\n");
  return stableEightDigits(hmacHex(secret, payload));
}

export function createPairingCode(secret: string, userId: string, realm: string, phone: string, now = Date.now()) {
  const bucket = Math.floor(now / PAIR_BUCKET_MS);
  return {
    code: pairingCodeForBucket(secret, userId, realm, phone, bucket),
    expiresAt: new Date((bucket + 2) * PAIR_BUCKET_MS).toISOString(),
  };
}

export function verifyPairingCode(secret: string, userId: string, realm: string, phone: string, code: string, now = Date.now()) {
  const bucket = Math.floor(now / PAIR_BUCKET_MS);
  return [bucket, bucket - 1].some((candidate) => safeSecretEqual(pairingCodeForBucket(secret, userId, realm, phone, candidate), code));
}

export function safeSecretEqual(expected: string, supplied: string) {
  const left = createHash("sha256").update(String(expected), "utf8").digest();
  const right = createHash("sha256").update(String(supplied), "utf8").digest();
  return timingSafeEqual(left, right) && expected.length === supplied.length;
}

export function parseFiveMLink(appMetadata: unknown): FiveMLinkMetadata | null {
  if (!appMetadata || typeof appMetadata !== "object") return null;
  const candidate = (appMetadata as Record<string, unknown>).majestic_fivem;
  if (!candidate || typeof candidate !== "object") return null;
  const record = candidate as Record<string, unknown>;
  if (record.version !== 1 || typeof record.realm !== "string" || typeof record.phone !== "string" || typeof record.subject_hash !== "string" || typeof record.linked_at !== "string") return null;
  if (!/^[a-f0-9]{64}$/.test(record.subject_hash)) return null;
  if (!/^\d{3,20}$/.test(record.phone)) return null;
  return { version: 1, realm: record.realm, phone: record.phone, subject_hash: record.subject_hash, linked_at: record.linked_at };
}

export function mergeFiveMLinkMetadata(appMetadata: unknown, link: FiveMLinkMetadata): Record<string, unknown> {
  const current = appMetadata && typeof appMetadata === "object" ? { ...(appMetadata as Record<string, unknown>) } : {};
  return { ...current, majestic_fivem: link };
}

export function removeFiveMLinkMetadata(appMetadata: unknown): Record<string, unknown> {
  const current = appMetadata && typeof appMetadata === "object" ? { ...(appMetadata as Record<string, unknown>) } : {};
  delete current.majestic_fivem;
  return current;
}

export function externalPurchaseReference(realm: string, operationId: string) {
  return `fivem:${realm}:subscription:${operationId}`;
}

export function encodePurchaseMarker(marker: PurchaseMarker) {
  const payload: PurchaseMarker = {
    state: marker.state,
    planCode: validatePlanCode(marker.planCode),
    billingDays: Math.max(1, Math.min(3650, Math.trunc(marker.billingDays))),
    preparedAt: new Date(marker.preparedAt).toISOString(),
    ...(marker.basePeriodEnd ? { basePeriodEnd: new Date(marker.basePeriodEnd).toISOString() } : {}),
    ...(marker.appliedPeriodEnd ? { appliedPeriodEnd: new Date(marker.appliedPeriodEnd).toISOString() } : {}),
  };
  return PURCHASE_MARKER_PREFIX + Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodePurchaseMarker(value: unknown): PurchaseMarker | null {
  const description = String(value ?? "");
  if (!description.startsWith(PURCHASE_MARKER_PREFIX) || description.length > 4096) return null;
  try {
    const json = Buffer.from(description.slice(PURCHASE_MARKER_PREFIX.length), "base64url").toString("utf8");
    const parsed = JSON.parse(json) as Partial<PurchaseMarker>;
    if (!new Set(["prepared", "applying", "cancelled"]).has(String(parsed.state))) return null;
    const planCode = validatePlanCode(parsed.planCode);
    const billingDays = Number(parsed.billingDays);
    if (!Number.isInteger(billingDays) || billingDays < 1 || billingDays > 3650) return null;
    const preparedAt = new Date(String(parsed.preparedAt ?? ""));
    if (!Number.isFinite(preparedAt.getTime())) return null;
    const result: PurchaseMarker = { state: parsed.state as PurchaseMarkerState, planCode, billingDays, preparedAt: preparedAt.toISOString() };
    for (const key of ["basePeriodEnd", "appliedPeriodEnd"] as const) {
      if (parsed[key]) {
        const date = new Date(String(parsed[key]));
        if (!Number.isFinite(date.getTime())) return null;
        result[key] = date.toISOString();
      }
    }
    return result;
  } catch {
    return null;
  }
}

export function addBillingDays(baseIso: string, billingDays: number) {
  const base = new Date(baseIso);
  if (!Number.isFinite(base.getTime())) throw new ControlPlaneError("PURCHASE_CONFLICT", "Purchase period is invalid.", 409);
  return new Date(base.getTime() + billingDays * 86_400_000).toISOString();
}

export function activePeriodBase(subscription: { status: string; current_period_end: string } | null, now = new Date()) {
  if (subscription?.status === "active" && new Date(subscription.current_period_end).getTime() > now.getTime()) return new Date(subscription.current_period_end).toISOString();
  return now.toISOString();
}

export function isInternalPurchaseDescription(value: unknown) {
  return String(value ?? "").startsWith(PURCHASE_MARKER_PREFIX);
}
