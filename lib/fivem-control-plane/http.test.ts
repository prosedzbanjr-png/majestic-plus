import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { assertMachineAuth, machinePost, resetControlRateLimitsForTests } from "./http";
import { ControlPlaneError } from "./contract";

describe("FiveM machine authentication", () => {
  beforeEach(() => {
    process.env.MAJESTIC_FIVEM_API_KEY = "unit-test-machine-key-long-enough";
    resetControlRateLimitsForTests();
  });

  afterEach(() => {
    delete process.env.MAJESTIC_FIVEM_API_KEY;
  });

  it("rejects missing Authorization", () => {
    const request = new Request("https://example.test/api", { method: "POST" });
    expect(() => assertMachineAuth(request)).toThrow(ControlPlaneError);
    try { assertMachineAuth(request); } catch (error) { expect((error as ControlPlaneError).code).toBe("UNAUTHORIZED"); }
  });

  it("rejects wrong bearer key", () => {
    const request = new Request("https://example.test/api", { headers: { Authorization: "Bearer wrong" } });
    expect(() => assertMachineAuth(request)).toThrow(ControlPlaneError);
  });

  it("accepts valid bearer key", () => {
    const request = new Request("https://example.test/api", {
      headers: { Authorization: "Bearer unit-test-machine-key-long-enough" },
    });
    expect(() => assertMachineAuth(request)).not.toThrow();
  });

  it("rejects auth before malformed body processing", async () => {
    const request = new NextRequest("https://example.test/api", {
      method: "POST",
      headers: { Authorization: "Bearer wrong", "Content-Type": "application/json" },
      body: "{ definitely-not-json",
    });
    let called = false;
    const response = await machinePost(request, "test-auth-order", async () => {
      called = true;
      return { version: "1", ok: true };
    });
    expect(response.status).toBe(401);
    expect(called).toBe(false);
    const payload = await response.json();
    expect(payload.error.code).toBe("UNAUTHORIZED");
  });

  it("parses body after valid auth", async () => {
    const request = new NextRequest("https://example.test/api", {
      method: "POST",
      headers: { Authorization: "Bearer unit-test-machine-key-long-enough", "Content-Type": "application/json" },
      body: JSON.stringify({ hello: "world" }),
    });
    const response = await machinePost(request, "test-valid", async (body) => ({ version: "1", ok: body.hello === "world" }));
    expect(response.status).toBe(200);
    expect((await response.json()).ok).toBe(true);
  });
});
