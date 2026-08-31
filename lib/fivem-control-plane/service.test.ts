import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPairingCode, deriveSubjectHash, encodePurchaseMarker } from "./contract";

const state = vi.hoisted(() => ({
  users: [] as any[], plans: [] as any[], subscriptions: new Map<string, any>(), transactions: [] as any[],
  productions: [] as any[], episodes: [] as any[], myList: new Map<string, Set<string>>(), walletTouches: 0, sequence: 1,
}));

vi.mock("@/lib/fivem-control-plane/supabase", () => ({
  listAuthUsersBounded: async () => state.users,
  getAdminViewerUser: async (id: string) => state.users.find((u) => u.id === id),
  updateAdminAppMetadata: async (id: string, app_metadata: Record<string, unknown>) => {
    const user = state.users.find((u) => u.id === id); user.app_metadata = app_metadata; return user;
  },
  controlRestRequest: async (path: string, init?: RequestInit) => {
    if (path.includes("majestic_wallets")) { state.walletTouches += 1; throw new Error("wallet touched"); }
    if (path.startsWith("majestic_subscription_plans?")) {
      const m = path.match(/id=eq\.([^&]+)/); return m ? state.plans.filter((p) => p.id === decodeURIComponent(m[1])) : state.plans;
    }
    if (path.startsWith("majestic_transactions?select=*&external_reference=eq.")) {
      const ref = decodeURIComponent(path.split("external_reference=eq.")[1].split("&")[0]);
      return state.transactions.filter((t) => t.external_reference === ref);
    }
    if (path === "majestic_transactions" && init?.method === "POST") {
      const tx = { id: `tx-${state.sequence++}`, created_at: new Date().toISOString(), ...JSON.parse(String(init.body)) };
      state.transactions.push(tx); return [tx];
    }
    if (path.startsWith("majestic_transactions?id=eq.") && init?.method === "PATCH") {
      const tx = state.transactions.find((t) => t.id === decodeURIComponent(path.split("id=eq.")[1]));
      Object.assign(tx, JSON.parse(String(init.body))); return [tx];
    }
    if (path.startsWith("majestic_subscriptions?select=*&user_id=eq.")) {
      const id = decodeURIComponent(path.split("user_id=eq.")[1].split("&")[0]); const sub = state.subscriptions.get(id); return sub ? [sub] : [];
    }
    if (path === "majestic_subscriptions?on_conflict=user_id" && init?.method === "POST") {
      const body = JSON.parse(String(init.body)); const old = state.subscriptions.get(body.user_id);
      const sub = { id: old?.id ?? `sub-${state.sequence++}`, created_at: old?.created_at ?? new Date().toISOString(), ...old, ...body };
      state.subscriptions.set(body.user_id, sub); return [sub];
    }
    if (path.startsWith("majestic_productions?select=*&id=eq.")) {
      const id = decodeURIComponent(path.split("id=eq.")[1].split("&")[0]); return state.productions.filter((p) => p.id === id);
    }
    throw new Error(`unmocked ${path}`);
  },
}));
vi.mock("@/lib/billing", () => ({
  getSubscriptionPlans: async () => state.plans,
  getViewerSubscription: async (id: string) => {
    const s = state.subscriptions.get(id); if (!s) return null;
    if (s.status === "active" && new Date(s.current_period_end).getTime() <= Date.now()) s.status = "expired";
    return { ...s, plan: state.plans.find((p) => p.id === s.plan_id) };
  },
}));
vi.mock("@/lib/viewer-data", () => ({
  getViewerProfile: async (id: string) => ({ id, display_name: `Profile ${id}` }),
  getMyListProductions: async (id: string) => state.productions.filter((p) => (state.myList.get(id) ?? new Set()).has(p.id) && p.status === "published"),
  addToMyList: async (id: string, pid: string) => { const set = state.myList.get(id) ?? new Set<string>(); set.add(pid); state.myList.set(id, set); },
  removeFromMyList: async (id: string, pid: string) => { state.myList.get(id)?.delete(pid); },
}));
vi.mock("@/lib/majestic-db", () => ({
  getProductionBySlug: async (slug: string) => state.productions.find((p) => p.slug === slug && p.status === "published") ?? null,
  getEpisodeById: async (id: string) => state.episodes.find((e) => e.id === id && e.status === "published") ?? null,
}));
vi.mock("@/lib/user-auth", () => ({ normalizeViewerUsername: (v: string) => v.trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, "").slice(0, 24) }));

import {
  authorizeFiveMPlayback, cancelFiveMPurchase, commitFiveMPurchase, confirmFiveMLink,
  listActivePlansForFiveM, listFiveMMyList, prepareFiveMPurchase, resolveAccount, setFiveMMyList, unlinkViewerFromFiveM,
} from "./service";

const secret = "unit-test-link-secret-that-is-long-enough", realm = "lucky-valley";
const u1 = "11111111-1111-4111-8111-111111111111", u2 = "22222222-2222-4222-8222-222222222222";
const op1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", op2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const movie = "33333333-3333-4333-8333-333333333333", series = "44444444-4444-4444-8444-444444444444", ep = "55555555-5555-4555-8555-555555555555";
const link = (subject = "license:one", phone = "5551234") => ({ version: 1, realm, phone, subject_hash: deriveSubjectHash(secret, realm, subject), linked_at: new Date().toISOString() });
const user = (id: string, name: string) => ({ id, email: `${name}@majestic.invalid`, user_metadata: { username: name, display_name: name }, app_metadata: { provider: "email", providers: ["email"], keep: true } as any });
const plan = () => ({ id: "plan-premiere", code: "premiere", name: "Premiere", price: 149, currency: "USD", billing_days: 30, max_devices: 4, quality: "4K", features: ["All"], active: true, display_order: 1 });
const sub = (end = "2099-10-01T00:00:00.000Z") => ({ id: "sub-1", user_id: u1, plan_id: "plan-premiere", status: "active", current_period_start: "2099-09-01T00:00:00.000Z", current_period_end: end, auto_renew: false, payment_source: "majestic_wallet", created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
const purchase = (operationId = op1) => ({ phone: "5551234", subject: "license:one", planCode: "premiere", operationId });

beforeEach(() => {
  process.env.MAJESTIC_FIVEM_REALM = realm; process.env.MAJESTIC_LINK_SECRET = secret;
  state.users = [user(u1, "alice")]; state.users[0].app_metadata.majestic_fivem = link(); state.plans = [plan()];
  state.subscriptions = new Map(); state.transactions = []; state.myList = new Map(); state.walletTouches = 0; state.sequence = 1;
  state.productions = [
    { id: movie, slug: "space-trip", title: "Space Trip", status: "published", content_type: "film", youtube_id: "CZvmavvgsZE" },
    { id: series, slug: "studio-series", title: "Studio Series", status: "published", content_type: "series", youtube_id: null },
  ];
  state.episodes = [{ id: ep, production_id: series, season_number: 1, episode_number: 1, title: "Pilot", status: "published", youtube_id: "CZvmavvgsZE" }];
});

describe("account linking/resolution", () => {
  it("links, preserves metadata, repeats idempotently, resolves and unlinks", async () => {
    delete state.users[0].app_metadata.majestic_fivem;
    const code = createPairingCode(secret, u1, realm, "5551234").code;
    await confirmFiveMLink({ username: "alice", code, phone: "555-1234", subject: "license:one" });
    expect(state.users[0].app_metadata).toMatchObject({ provider: "email", providers: ["email"], keep: true });
    expect((await confirmFiveMLink({ username: "alice", code, phone: "5551234", subject: "license:one" })).linked).toBe(true);
    expect((await resolveAccount({ phone: "5551234", subject: "license:one" })).account.username).toBe("alice");
    await unlinkViewerFromFiveM(u1); expect(state.users[0].app_metadata.majestic_fivem).toBeUndefined();
    await expect(resolveAccount({ phone: "5551234", subject: "license:one" })).rejects.toMatchObject({ code: "ACCOUNT_NOT_LINKED" });
  });
  it("enforces account, identity and phone conflicts", async () => {
    let code = createPairingCode(secret, u1, realm, "9991234").code;
    await expect(confirmFiveMLink({ username: "alice", code, phone: "9991234", subject: "license:new" })).rejects.toMatchObject({ code: "ACCOUNT_ALREADY_LINKED" });
    delete state.users[0].app_metadata.majestic_fivem; const bob = user(u2, "bob"); bob.app_metadata.majestic_fivem = link("license:one", "7771234"); state.users.push(bob);
    code = createPairingCode(secret, u1, realm, "5551234").code;
    await expect(confirmFiveMLink({ username: "alice", code, phone: "5551234", subject: "license:one" })).rejects.toMatchObject({ code: "IDENTITY_ALREADY_LINKED" });
    bob.app_metadata.majestic_fivem = link("license:two", "5551234");
    await expect(confirmFiveMLink({ username: "alice", code, phone: "5551234", subject: "license:one" })).rejects.toMatchObject({ code: "PHONE_ALREADY_LINKED" });
  });
  it("detects changed phone", async () => {
    await expect(resolveAccount({ phone: "9991234", subject: "license:one" })).rejects.toMatchObject({ code: "PHONE_CHANGED" });
  });
});

describe("subscription plans and settlement", () => {
  it("returns active plans and authoritative price without wallet mutation", async () => {
    state.plans.push({ ...plan(), id: "old", code: "old", active: false });
    expect((await listActivePlansForFiveM()).plans.map((p) => p.code)).toEqual(["premiere"]);
    await prepareFiveMPurchase({ ...purchase(), price: 1 });
    expect(state.transactions[0]).toMatchObject({ amount: 149, currency: "USD", external_reference: `fivem:${realm}:subscription:${op1}` });
    expect(state.walletTouches).toBe(0);
  });
  it("prepare retry is idempotent, cancelled prepare is rejected", async () => {
    await prepareFiveMPurchase(purchase()); await prepareFiveMPurchase(purchase()); expect(state.transactions).toHaveLength(1);
    await cancelFiveMPurchase({ phone: "5551234", subject: "license:one", operationId: op1, reason: "ABORTED" });
    await expect(prepareFiveMPurchase(purchase())).rejects.toMatchObject({ code: "OPERATION_CANCELLED" });
  });
  it("commit extends active subscription and retry does not extend twice", async () => {
    state.subscriptions.set(u1, sub()); const before = state.subscriptions.get(u1).current_period_end;
    await prepareFiveMPurchase(purchase()); await commitFiveMPurchase({ phone: "5551234", subject: "license:one", operationId: op1 });
    const after = state.subscriptions.get(u1).current_period_end;
    expect(new Date(after).getTime() - new Date(before).getTime()).toBe(30 * 86_400_000);
    expect(state.subscriptions.get(u1).payment_source).toBe("fivem_esx");
    await commitFiveMPurchase({ phone: "5551234", subject: "license:one", operationId: op1 }); expect(state.subscriptions.get(u1).current_period_end).toBe(after);
    expect((await prepareFiveMPurchase(purchase())).state).toBe("already_committed"); expect(state.walletTouches).toBe(0);
  });
  it("starts expired subscription and recovers applying state", async () => {
    state.subscriptions.set(u1, { ...sub("2020-01-01T00:00:00.000Z"), status: "expired" });
    await prepareFiveMPurchase(purchase()); await commitFiveMPurchase({ phone: "5551234", subject: "license:one", operationId: op1 });
    expect(new Date(state.subscriptions.get(u1).current_period_end).getTime()).toBeGreaterThan(Date.now() + 29 * 86_400_000);
    state.transactions = []; state.subscriptions.set(u1, sub()); await prepareFiveMPurchase(purchase(op2));
    const base = state.subscriptions.get(u1).current_period_end, target = new Date(new Date(base).getTime() + 30 * 86_400_000).toISOString();
    state.transactions[0].description = encodePurchaseMarker({ state: "applying", planCode: "premiere", billingDays: 30, preparedAt: new Date().toISOString(), basePeriodEnd: base, appliedPeriodEnd: target });
    await commitFiveMPurchase({ phone: "5551234", subject: "license:one", operationId: op2 }); expect(state.subscriptions.get(u1).current_period_end).toBe(target);
  });
  it("cancel is idempotent, completed cancel rejected, account mismatch rejected", async () => {
    await prepareFiveMPurchase(purchase());
    expect((await cancelFiveMPurchase({ phone: "5551234", subject: "license:one", operationId: op1, reason: "DEBIT_FAILED" })).state).toBe("cancelled");
    expect((await cancelFiveMPurchase({ phone: "5551234", subject: "license:one", operationId: op1, reason: "DEBIT_FAILED" })).state).toBe("cancelled");
    state.transactions = []; await prepareFiveMPurchase(purchase()); await commitFiveMPurchase({ phone: "5551234", subject: "license:one", operationId: op1 });
    await expect(cancelFiveMPurchase({ phone: "5551234", subject: "license:one", operationId: op1, reason: "ABORTED" })).rejects.toMatchObject({ code: "OPERATION_ALREADY_COMMITTED" });
    state.transactions = [{ ...state.transactions[0], id: "other", user_id: u2, status: "failed", external_reference: `fivem:${realm}:subscription:${op2}`, description: encodePurchaseMarker({ state: "prepared", planCode: "premiere", billingDays: 30, preparedAt: new Date().toISOString() }) }];
    await expect(prepareFiveMPurchase(purchase(op2))).rejects.toMatchObject({ code: "PURCHASE_CONFLICT" });
  });
});

describe("shared My List", () => {
  it("lists empty, adds/removes idempotently and rejects missing content", async () => {
    expect((await listFiveMMyList({ phone: "5551234", subject: "license:one" })).items).toEqual([]);
    await setFiveMMyList({ phone: "5551234", subject: "license:one", slug: "space-trip", saved: true });
    await setFiveMMyList({ phone: "5551234", subject: "license:one", slug: "space-trip", saved: true });
    expect((await listFiveMMyList({ phone: "5551234", subject: "license:one" })).items.map((i) => i.slug)).toEqual(["space-trip"]);
    await setFiveMMyList({ phone: "5551234", subject: "license:one", slug: "space-trip", saved: false });
    await setFiveMMyList({ phone: "5551234", subject: "license:one", slug: "space-trip", saved: false });
    expect((await listFiveMMyList({ phone: "5551234", subject: "license:one" })).items).toEqual([]);
    await expect(setFiveMMyList({ phone: "5551234", subject: "license:one", slug: "missing", saved: true })).rejects.toMatchObject({ code: "CONTENT_UNAVAILABLE" });
  });
  it("requires a linked account", async () => {
    await expect(listFiveMMyList({ phone: "5551234", subject: "license:none" })).rejects.toMatchObject({ code: "ACCOUNT_NOT_LINKED" });
  });
});

describe("playback authorization", () => {
  it("authorizes published movie and episode for active subscription", async () => {
    state.subscriptions.set(u1, sub());
    expect((await authorizeFiveMPlayback({ phone: "5551234", subject: "license:one", target: { kind: "movie", slug: "space-trip" } })).playback).toMatchObject({ provider: "youtube", kind: "movie", videoId: "CZvmavvgsZE" });
    expect((await authorizeFiveMPlayback({ phone: "5551234", subject: "license:one", target: { kind: "episode", episodeId: ep } })).playback).toMatchObject({ provider: "youtube", kind: "episode", videoId: "CZvmavvgsZE", seriesTitle: "Studio Series" });
  });
  it("rejects missing/expired subscription", async () => {
    await expect(authorizeFiveMPlayback({ phone: "5551234", subject: "license:one", target: { kind: "movie", slug: "space-trip" } })).rejects.toMatchObject({ code: "SUBSCRIPTION_REQUIRED" });
    state.subscriptions.set(u1, sub("2020-01-01T00:00:00.000Z"));
    await expect(authorizeFiveMPlayback({ phone: "5551234", subject: "license:one", target: { kind: "movie", slug: "space-trip" } })).rejects.toMatchObject({ code: "SUBSCRIPTION_REQUIRED" });
  });
  it("rejects unpublished/missing media and invalid target", async () => {
    state.subscriptions.set(u1, sub()); state.productions[0].youtube_id = null;
    await expect(authorizeFiveMPlayback({ phone: "5551234", subject: "license:one", target: { kind: "movie", slug: "space-trip" } })).rejects.toMatchObject({ code: "PLAYBACK_UNAVAILABLE" });
    state.productions[0].youtube_id = "CZvmavvgsZE"; state.episodes[0].status = "draft";
    await expect(authorizeFiveMPlayback({ phone: "5551234", subject: "license:one", target: { kind: "episode", episodeId: ep } })).rejects.toMatchObject({ code: "CONTENT_UNAVAILABLE" });
    state.episodes[0].status = "published"; state.productions[1].status = "draft";
    await expect(authorizeFiveMPlayback({ phone: "5551234", subject: "license:one", target: { kind: "episode", episodeId: ep } })).rejects.toMatchObject({ code: "CONTENT_UNAVAILABLE" });
    await expect(authorizeFiveMPlayback({ phone: "5551234", subject: "license:one", target: { kind: "wat" } })).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });
});
