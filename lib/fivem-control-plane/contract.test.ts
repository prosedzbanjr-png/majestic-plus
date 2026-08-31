import { describe, expect, it } from "vitest";
import {
  ControlPlaneError,
  activePeriodBase,
  addBillingDays,
  createPairingCode,
  decodePurchaseMarker,
  deriveSubjectHash,
  encodePurchaseMarker,
  externalPurchaseReference,
  maskPhone,
  mergeFiveMLinkMetadata,
  normalizePhone,
  parseFiveMLink,
  removeFiveMLinkMetadata,
  safeSecretEqual,
  validateOperationId,
  verifyPairingCode,
} from "./contract";

const secret = "test-link-secret-that-is-long-enough";
const realm = "lucky-valley";
const userId = "11111111-1111-4111-8111-111111111111";

function expectCode(fn: () => unknown, code: string) {
  try {
    fn();
    throw new Error("expected error");
  } catch (error) {
    expect(error).toBeInstanceOf(ControlPlaneError);
    expect((error as ControlPlaneError).code).toBe(code);
  }
}

describe("FiveM control-plane contract", () => {
  it("normalizes phone numbers", () => {
    expect(normalizePhone(" 555-12 34 ")).toBe("5551234");
  });

  it("rejects invalid phone length", () => {
    expectCode(() => normalizePhone("12"), "INVALID_REQUEST");
  });

  it("masks phone numbers", () => {
    expect(maskPhone("5551234")).toBe("***1234");
  });

  it("derives stable realm-scoped subject hashes", () => {
    const first = deriveSubjectHash(secret, realm, "license:abc");
    expect(first).toHaveLength(64);
    expect(deriveSubjectHash(secret, realm, "license:abc")).toBe(first);
    expect(deriveSubjectHash(secret, "other", "license:abc")).not.toBe(first);
    expect(deriveSubjectHash(secret, realm, "license:def")).not.toBe(first);
  });

  it("creates and accepts current pairing code", () => {
    const now = 1_800_000_000_000;
    const pair = createPairingCode(secret, userId, realm, "5551234", now);
    expect(pair.code).toMatch(/^\d{8}$/);
    expect(verifyPairingCode(secret, userId, realm, "5551234", pair.code, now)).toBe(true);
  });

  it("accepts a code in the immediately following bucket", () => {
    const now = 1_800_000_000_000;
    const pair = createPairingCode(secret, userId, realm, "5551234", now);
    expect(verifyPairingCode(secret, userId, realm, "5551234", pair.code, now + 150_001)).toBe(true);
  });

  it("rejects expired pairing code", () => {
    const now = 1_800_000_000_000;
    const pair = createPairingCode(secret, userId, realm, "5551234", now);
    expect(verifyPairingCode(secret, userId, realm, "5551234", pair.code, now + 300_001)).toBe(false);
  });

  it("rejects pairing code for wrong phone", () => {
    const now = 1_800_000_000_000;
    const pair = createPairingCode(secret, userId, realm, "5551234", now);
    expect(verifyPairingCode(secret, userId, realm, "9991234", pair.code, now)).toBe(false);
  });

  it("merges FiveM metadata without removing provider fields", () => {
    const merged = mergeFiveMLinkMetadata(
      { provider: "email", providers: ["email"], other: { keep: true } },
      { version: 1, realm, phone: "5551234", subject_hash: "a".repeat(64), linked_at: "2026-08-31T12:00:00.000Z" },
    );
    expect(merged.provider).toBe("email");
    expect(merged.providers).toEqual(["email"]);
    expect(merged.other).toEqual({ keep: true });
    expect(parseFiveMLink(merged)?.phone).toBe("5551234");
  });

  it("removes only majestic_fivem metadata on unlink", () => {
    const result = removeFiveMLinkMetadata({
      provider: "email",
      providers: ["email"],
      majestic_fivem: { anything: true },
      unrelated: "keep",
    });
    expect(result).toEqual({ provider: "email", providers: ["email"], unrelated: "keep" });
  });

  it("uses constant-time-compatible secret comparison semantics", () => {
    expect(safeSecretEqual("abc", "abc")).toBe(true);
    expect(safeSecretEqual("abc", "abd")).toBe(false);
    expect(safeSecretEqual("abc", "abc ")).toBe(false);
  });

  it("validates UUID operation IDs", () => {
    expect(validateOperationId("11111111-1111-4111-8111-111111111111")).toBe("11111111-1111-4111-8111-111111111111");
    expectCode(() => validateOperationId("not-a-uuid"), "INVALID_REQUEST");
  });

  it("builds stable external purchase references", () => {
    expect(externalPurchaseReference(realm, "11111111-1111-4111-8111-111111111111"))
      .toBe("fivem:lucky-valley:subscription:11111111-1111-4111-8111-111111111111");
  });

  it("round-trips bounded purchase markers", () => {
    const encoded = encodePurchaseMarker({
      state: "applying",
      planCode: "premiere",
      billingDays: 30,
      preparedAt: "2026-08-31T12:00:00.000Z",
      basePeriodEnd: "2026-09-01T12:00:00.000Z",
      appliedPeriodEnd: "2026-10-01T12:00:00.000Z",
    });
    expect(decodePurchaseMarker(encoded)).toEqual({
      state: "applying",
      planCode: "premiere",
      billingDays: 30,
      preparedAt: "2026-08-31T12:00:00.000Z",
      basePeriodEnd: "2026-09-01T12:00:00.000Z",
      appliedPeriodEnd: "2026-10-01T12:00:00.000Z",
    });
  });

  it("rejects malformed internal purchase markers", () => {
    expect(decodePurchaseMarker("not-internal")).toBeNull();
    expect(decodePurchaseMarker("__MPLUS_FIVEM_PURCHASE_V1__:wat")).toBeNull();
  });

  it("extends an active subscription from its current end", () => {
    const base = activePeriodBase(
      { status: "active", current_period_end: "2026-10-01T00:00:00.000Z" },
      new Date("2026-09-01T00:00:00.000Z"),
    );
    expect(base).toBe("2026-10-01T00:00:00.000Z");
    expect(addBillingDays(base, 30)).toBe("2026-10-31T00:00:00.000Z");
  });

  it("starts an expired subscription from now", () => {
    const now = new Date("2026-09-01T00:00:00.000Z");
    const base = activePeriodBase(
      { status: "expired", current_period_end: "2026-08-01T00:00:00.000Z" },
      now,
    );
    expect(base).toBe(now.toISOString());
  });
});
