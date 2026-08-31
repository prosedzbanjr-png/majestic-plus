import { getViewerSubscription, type SubscriptionPlan, type ViewerSubscription, getSubscriptionPlans } from "@/lib/billing";
import { getEpisodeById, getProductionBySlug, type Episode, type Production } from "@/lib/majestic-db";
import { addToMyList, getMyListProductions, getViewerProfile, removeFromMyList } from "@/lib/viewer-data";
import { normalizeViewerUsername } from "@/lib/user-auth";
import {
  CONTROL_PLANE_VERSION,
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
  normalizeRealm,
  parseFiveMLink,
  removeFiveMLinkMetadata,
  validateCancelReason,
  validateOperationId,
  validatePairCode,
  validatePlanCode,
  validateSubject,
  validateUsername,
  verifyPairingCode,
  type FiveMLinkMetadata,
  type PurchaseMarker,
} from "./contract";
import {
  controlRestRequest,
  getAdminViewerUser,
  listAuthUsersBounded,
  updateAdminAppMetadata,
  type AdminViewerUser,
} from "./supabase";

export type LinkedViewer = {
  user: AdminViewerUser;
  link: FiveMLinkMetadata;
};

type RawTransaction = {
  id: string;
  user_id: string;
  plan_id: string | null;
  transaction_type: string;
  direction: string;
  amount: number;
  currency: string;
  status: "completed" | "failed" | "refunded";
  description: string;
  external_reference: string | null;
  created_at: string;
};

type RawSubscription = {
  id: string;
  user_id: string;
  plan_id: string;
  status: "active" | "expired" | "cancelled";
  current_period_start: string;
  current_period_end: string;
  auto_renew: boolean;
  payment_source: string;
  created_at: string;
  updated_at: string;
};

function realm() {
  return normalizeRealm(process.env.MAJESTIC_FIVEM_REALM);
}

function linkSecret() {
  const secret = process.env.MAJESTIC_LINK_SECRET?.trim() ?? "";
  if (secret.length < 24) {
    throw new ControlPlaneError("INTERNAL_ERROR", "FiveM link secret is not configured.", 500, true);
  }
  return secret;
}

export function isFiveMControlPlaneConfigured() {
  try {
    realm();
    linkSecret();
    return true;
  } catch {
    return false;
  }
}

function authUsername(user: AdminViewerUser) {
  const metadata = normalizeViewerUsername(String(user.user_metadata?.username ?? ""));
  if (metadata) return metadata;
  return normalizeViewerUsername(String(user.email ?? "").split("@")[0]);
}

function authDisplayName(user: AdminViewerUser) {
  const display = String(user.user_metadata?.display_name ?? "").trim().slice(0, 80);
  return display || authUsername(user) || "Viewer";
}

async function profileDisplayName(user: AdminViewerUser) {
  try {
    const profile = await getViewerProfile(user.id);
    return String(profile?.display_name ?? "").trim() || authDisplayName(user);
  } catch {
    return authDisplayName(user);
  }
}

function planDto(plan: SubscriptionPlan) {
  return {
    code: plan.code,
    name: plan.name,
    price: Number(plan.price),
    currency: plan.currency,
    billingDays: Number(plan.billing_days),
    maxDevices: Number(plan.max_devices),
    quality: plan.quality,
    features: Array.isArray(plan.features) ? plan.features.map(String).slice(0, 20) : [],
  };
}

function subscriptionDto(subscription: ViewerSubscription | null) {
  const active = Boolean(
    subscription &&
      subscription.status === "active" &&
      new Date(subscription.current_period_end).getTime() > Date.now(),
  );
  return {
    active,
    planCode: active ? subscription?.plan?.code ?? null : null,
    planName: active ? subscription?.plan?.name ?? null : null,
    currentPeriodEnd: active ? subscription?.current_period_end ?? null : null,
  };
}

async function accountDto(user: AdminViewerUser, link: FiveMLinkMetadata) {
  return {
    version: CONTROL_PLANE_VERSION,
    ok: true,
    linked: true,
    account: {
      username: authUsername(user),
      displayName: await profileDisplayName(user),
    },
    phone: { masked: maskPhone(link.phone) },
    subscription: subscriptionDto(await getViewerSubscription(user.id)),
  };
}

async function allLinks() {
  const users = await listAuthUsersBounded();
  return users.map((user) => ({ user, link: parseFiveMLink(user.app_metadata) })).filter((entry) => entry.link) as LinkedViewer[];
}

async function findUserByUsername(username: string) {
  const users = await listAuthUsersBounded();
  return users.find((user) => authUsername(user) === username) ?? null;
}

export async function getViewerFiveMLinkStatus(userId: string) {
  if (!isFiveMControlPlaneConfigured()) {
    return { configured: false, linked: false, maskedPhone: null, realm: null };
  }
  try {
    const user = await getAdminViewerUser(userId);
    const link = parseFiveMLink(user.app_metadata);
    if (!link || link.realm !== realm()) {
      return { configured: true, linked: false, maskedPhone: null, realm: realm() };
    }
    return { configured: true, linked: true, maskedPhone: maskPhone(link.phone), realm: link.realm };
  } catch {
    return { configured: true, linked: false, maskedPhone: null, realm: realm() };
  }
}

export async function createViewerPairingChallenge(userId: string, username: string, rawPhone: unknown) {
  const currentRealm = realm();
  const phone = normalizePhone(rawPhone);
  const code = createPairingCode(linkSecret(), userId, currentRealm, phone);
  return {
    ok: true,
    code: code.code,
    expiresAt: code.expiresAt,
    username: validateUsername(username),
  };
}

export async function unlinkViewerFromFiveM(userId: string) {
  const user = await getAdminViewerUser(userId);
  const current = parseFiveMLink(user.app_metadata);
  if (!current) return { version: CONTROL_PLANE_VERSION, ok: true, linked: false };
  await updateAdminAppMetadata(userId, removeFiveMLinkMetadata(user.app_metadata));
  return { version: CONTROL_PLANE_VERSION, ok: true, linked: false };
}

export async function confirmFiveMLink(body: Record<string, unknown>) {
  const currentRealm = realm();
  const secret = linkSecret();
  const username = validateUsername(body.username);
  const code = validatePairCode(body.code);
  const phone = normalizePhone(body.phone);
  const subject = validateSubject(body.subject);
  const user = await findUserByUsername(username);
  if (!user || !verifyPairingCode(secret, user.id, currentRealm, phone, code)) {
    throw new ControlPlaneError("LINK_INVALID", "Pairing code is invalid or expired.", 400);
  }

  const subjectHash = deriveSubjectHash(secret, currentRealm, subject);
  const links = await allLinks();
  const existingOnAccount = links.find((entry) => entry.user.id === user.id);
  if (existingOnAccount) {
    if (
      existingOnAccount.link.realm === currentRealm &&
      existingOnAccount.link.subject_hash === subjectHash &&
      existingOnAccount.link.phone === phone
    ) {
      return accountDto(existingOnAccount.user, existingOnAccount.link);
    }
    throw new ControlPlaneError("ACCOUNT_ALREADY_LINKED", "This Majestic+ account is already linked.", 409);
  }
  if (links.some((entry) => entry.link.realm === currentRealm && entry.link.subject_hash === subjectHash)) {
    throw new ControlPlaneError("IDENTITY_ALREADY_LINKED", "This FiveM identity is already linked.", 409);
  }
  if (links.some((entry) => entry.link.realm === currentRealm && entry.link.phone === phone)) {
    throw new ControlPlaneError("PHONE_ALREADY_LINKED", "This phone number is already linked.", 409);
  }

  const link: FiveMLinkMetadata = {
    version: 1,
    realm: currentRealm,
    phone,
    subject_hash: subjectHash,
    linked_at: new Date().toISOString(),
  };
  const updated = await updateAdminAppMetadata(user.id, mergeFiveMLinkMetadata(user.app_metadata, link));
  return accountDto(updated, link);
}

export async function resolveLinkedViewer(rawPhone: unknown, rawSubject: unknown): Promise<LinkedViewer> {
  const currentRealm = realm();
  const phone = normalizePhone(rawPhone);
  const subject = validateSubject(rawSubject);
  const subjectHash = deriveSubjectHash(linkSecret(), currentRealm, subject);
  const links = await allLinks();
  const subjectMatch = links.find(
    (entry) => entry.link.realm === currentRealm && entry.link.subject_hash === subjectHash,
  );
  if (!subjectMatch) {
    throw new ControlPlaneError("ACCOUNT_NOT_LINKED", "Majestic+ account is not linked.", 404);
  }
  if (subjectMatch.link.phone !== phone) {
    throw new ControlPlaneError("PHONE_CHANGED", "Linked phone number has changed.", 409);
  }
  return subjectMatch;
}

export async function resolveAccount(body: Record<string, unknown>) {
  const linked = await resolveLinkedViewer(body.phone, body.subject);
  return accountDto(linked.user, linked.link);
}

export async function listActivePlansForFiveM() {
  const plans = await getSubscriptionPlans();
  return {
    version: CONTROL_PLANE_VERSION,
    ok: true,
    plans: plans.filter((plan) => plan.active).map(planDto),
  };
}

async function activePlanByCode(code: string) {
  const plan = (await getSubscriptionPlans()).find((candidate) => candidate.active && candidate.code === code);
  if (!plan) throw new ControlPlaneError("PLAN_NOT_FOUND", "Subscription plan was not found.", 404);
  return plan;
}

async function planById(planId: string) {
  const rows = await controlRestRequest<SubscriptionPlan[]>(
    `majestic_subscription_plans?select=*&id=eq.${encodeURIComponent(planId)}&limit=1`,
  );
  const plan = rows[0] ?? null;
  if (!plan) throw new ControlPlaneError("PLAN_NOT_FOUND", "Subscription plan was not found.", 404);
  return plan;
}

async function transactionByReference(reference: string) {
  const rows = await controlRestRequest<RawTransaction[]>(
    `majestic_transactions?select=*&external_reference=eq.${encodeURIComponent(reference)}&order=created_at.asc&limit=2`,
  );
  if (rows.length > 1) {
    throw new ControlPlaneError("PURCHASE_CONFLICT", "Duplicate purchase operation detected.", 409);
  }
  return rows[0] ?? null;
}

async function rawSubscription(userId: string) {
  const rows = await controlRestRequest<RawSubscription[]>(
    `majestic_subscriptions?select=*&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
  );
  return rows[0] ?? null;
}

async function insertPreparedTransaction(userId: string, plan: SubscriptionPlan, reference: string, marker: PurchaseMarker) {
  const rows = await controlRestRequest<RawTransaction[]>("majestic_transactions", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      user_id: userId,
      plan_id: plan.id,
      transaction_type: "subscription_purchase",
      direction: "debit",
      amount: plan.price,
      currency: plan.currency,
      status: "failed",
      description: encodePurchaseMarker(marker),
      external_reference: reference,
    }),
  });
  return rows[0];
}

async function patchTransaction(id: string, patch: Record<string, unknown>) {
  const rows = await controlRestRequest<RawTransaction[]>(
    `majestic_transactions?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(patch),
    },
  );
  return rows[0] ?? null;
}

function preparedResponse(plan: SubscriptionPlan, operationId: string, state: string) {
  return {
    version: CONTROL_PLANE_VERSION,
    ok: true,
    state,
    operationId,
    plan: {
      code: plan.code,
      name: plan.name,
      price: Number(plan.price),
      currency: plan.currency,
      billingDays: Number(plan.billing_days),
    },
  };
}

export async function prepareFiveMPurchase(body: Record<string, unknown>) {
  const linked = await resolveLinkedViewer(body.phone, body.subject);
  const planCode = validatePlanCode(body.planCode);
  const operationId = validateOperationId(body.operationId);
  const reference = externalPurchaseReference(realm(), operationId);
  const existing = await transactionByReference(reference);
  if (existing) {
    if (existing.user_id !== linked.user.id) {
      throw new ControlPlaneError("PURCHASE_CONFLICT", "Purchase operation belongs to another account.", 409);
    }
    const storedPlan = await planById(String(existing.plan_id ?? ""));
    if (storedPlan.code !== planCode) {
      throw new ControlPlaneError("PURCHASE_CONFLICT", "Purchase operation plan does not match.", 409);
    }
    if (existing.status === "completed") return preparedResponse(storedPlan, operationId, "already_committed");
    const marker = decodePurchaseMarker(existing.description);
    if (!marker) throw new ControlPlaneError("PURCHASE_CONFLICT", "Purchase operation state is invalid.", 409);
    if (marker.state === "cancelled") {
      throw new ControlPlaneError("OPERATION_CANCELLED", "Purchase operation was cancelled.", 409);
    }
    return preparedResponse(storedPlan, operationId, marker.state === "applying" ? "applying" : "prepared");
  }

  const plan = await activePlanByCode(planCode);
  const subscription = await rawSubscription(linked.user.id);
  const marker: PurchaseMarker = {
    state: "prepared",
    planCode: plan.code,
    billingDays: plan.billing_days,
    preparedAt: new Date().toISOString(),
    basePeriodEnd: activePeriodBase(subscription),
  };
  await insertPreparedTransaction(linked.user.id, plan, reference, marker);
  return preparedResponse(plan, operationId, "prepared");
}

async function upsertSubscription(userId: string, plan: SubscriptionPlan, periodStart: string, periodEnd: string) {
  const rows = await controlRestRequest<RawSubscription[]>("majestic_subscriptions?on_conflict=user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      user_id: userId,
      plan_id: plan.id,
      status: "active",
      current_period_start: periodStart,
      current_period_end: periodEnd,
      auto_renew: false,
      payment_source: "fivem_esx",
      updated_at: new Date().toISOString(),
    }),
  });
  return rows[0];
}

async function finalizeTransaction(transaction: RawTransaction, plan: SubscriptionPlan) {
  return patchTransaction(transaction.id, {
    status: "completed",
    description: `Majestic+ ${plan.name} · ${plan.billing_days} dni · FiveM`,
  });
}

function subscriptionAlreadyAtOrPast(subscription: RawSubscription | null, targetIso: string) {
  return Boolean(
    subscription?.status === "active" &&
      new Date(subscription.current_period_end).getTime() >= new Date(targetIso).getTime(),
  );
}

export async function commitFiveMPurchase(body: Record<string, unknown>) {
  const linked = await resolveLinkedViewer(body.phone, body.subject);
  const operationId = validateOperationId(body.operationId);
  const reference = externalPurchaseReference(realm(), operationId);
  let transaction = await transactionByReference(reference);
  if (!transaction) throw new ControlPlaneError("OPERATION_NOT_FOUND", "Purchase operation was not found.", 404);
  if (transaction.user_id !== linked.user.id) {
    throw new ControlPlaneError("PURCHASE_CONFLICT", "Purchase operation belongs to another account.", 409);
  }
  const plan = await planById(String(transaction.plan_id ?? ""));
  if (transaction.status === "completed") {
    return {
      version: CONTROL_PLANE_VERSION,
      ok: true,
      state: "committed",
      operationId,
      subscription: subscriptionDto(await getViewerSubscription(linked.user.id)),
    };
  }

  let marker = decodePurchaseMarker(transaction.description);
  if (!marker) throw new ControlPlaneError("PURCHASE_CONFLICT", "Purchase operation state is invalid.", 409);
  if (marker.state === "cancelled") {
    throw new ControlPlaneError("OPERATION_CANCELLED", "Purchase operation was cancelled.", 409);
  }

  let current = await rawSubscription(linked.user.id);
  if (marker.state === "applying" && marker.appliedPeriodEnd) {
    if (subscriptionAlreadyAtOrPast(current, marker.appliedPeriodEnd)) {
      await finalizeTransaction(transaction, plan);
      return {
        version: CONTROL_PLANE_VERSION,
        ok: true,
        state: "committed",
        operationId,
        subscription: subscriptionDto(await getViewerSubscription(linked.user.id)),
      };
    }
  }

  let base = activePeriodBase(current);
  let target = addBillingDays(base, marker.billingDays);
  if (marker.state === "applying" && marker.basePeriodEnd && marker.appliedPeriodEnd) {
    base = marker.basePeriodEnd;
    target = marker.appliedPeriodEnd;
    const currentActiveBase = activePeriodBase(current);
    if (
      current?.status === "active" &&
      new Date(currentActiveBase).getTime() > new Date(base).getTime() &&
      new Date(currentActiveBase).getTime() < new Date(target).getTime()
    ) {
      base = currentActiveBase;
      target = addBillingDays(base, marker.billingDays);
    }
  }

  marker = { ...marker, state: "applying", basePeriodEnd: base, appliedPeriodEnd: target };
  transaction = (await patchTransaction(transaction.id, { description: encodePurchaseMarker(marker) })) ?? transaction;

  current = await rawSubscription(linked.user.id);
  if (subscriptionAlreadyAtOrPast(current, target)) {
    await finalizeTransaction(transaction, plan);
    return {
      version: CONTROL_PLANE_VERSION,
      ok: true,
      state: "committed",
      operationId,
      subscription: subscriptionDto(await getViewerSubscription(linked.user.id)),
    };
  }

  if (current?.status === "active" && new Date(current.current_period_end).getTime() > new Date(base).getTime()) {
    base = new Date(current.current_period_end).toISOString();
    target = addBillingDays(base, marker.billingDays);
    marker = { ...marker, basePeriodEnd: base, appliedPeriodEnd: target };
    transaction = (await patchTransaction(transaction.id, { description: encodePurchaseMarker(marker) })) ?? transaction;
  }

  const nowIso = new Date().toISOString();
  const periodStart = current?.status === "active" && new Date(current.current_period_end).getTime() > Date.now()
    ? current.current_period_start
    : nowIso;
  await upsertSubscription(linked.user.id, plan, periodStart, target);
  await finalizeTransaction(transaction, plan);
  return {
    version: CONTROL_PLANE_VERSION,
    ok: true,
    state: "committed",
    operationId,
    subscription: subscriptionDto(await getViewerSubscription(linked.user.id)),
  };
}

export async function cancelFiveMPurchase(body: Record<string, unknown>) {
  const linked = await resolveLinkedViewer(body.phone, body.subject);
  const operationId = validateOperationId(body.operationId);
  validateCancelReason(body.reason);
  const reference = externalPurchaseReference(realm(), operationId);
  const transaction = await transactionByReference(reference);
  if (!transaction) throw new ControlPlaneError("OPERATION_NOT_FOUND", "Purchase operation was not found.", 404);
  if (transaction.user_id !== linked.user.id) {
    throw new ControlPlaneError("PURCHASE_CONFLICT", "Purchase operation belongs to another account.", 409);
  }
  const plan = await planById(String(transaction.plan_id ?? ""));
  if (transaction.status === "completed") {
    throw new ControlPlaneError("OPERATION_ALREADY_COMMITTED", "Purchase operation is already committed.", 409);
  }
  const marker = decodePurchaseMarker(transaction.description);
  if (!marker) throw new ControlPlaneError("PURCHASE_CONFLICT", "Purchase operation state is invalid.", 409);
  if (marker.state === "cancelled") {
    return { version: CONTROL_PLANE_VERSION, ok: true, state: "cancelled", operationId };
  }
  if (marker.state === "applying" && marker.appliedPeriodEnd) {
    const subscription = await rawSubscription(linked.user.id);
    if (subscriptionAlreadyAtOrPast(subscription, marker.appliedPeriodEnd)) {
      await finalizeTransaction(transaction, plan);
      throw new ControlPlaneError("OPERATION_ALREADY_COMMITTED", "Purchase operation is already committed.", 409);
    }
  }
  await patchTransaction(transaction.id, {
    status: "failed",
    description: encodePurchaseMarker({ ...marker, state: "cancelled" }),
  });
  return { version: CONTROL_PLANE_VERSION, ok: true, state: "cancelled", operationId };
}

export async function listFiveMMyList(body: Record<string, unknown>) {
  const linked = await resolveLinkedViewer(body.phone, body.subject);
  const productions = await getMyListProductions(linked.user.id);
  return {
    version: CONTROL_PLANE_VERSION,
    ok: true,
    items: productions.map((production) => ({
      id: production.id,
      slug: production.slug,
      title: production.title,
      type: production.content_type === "series" ? "series" : "movie",
    })),
  };
}

export async function setFiveMMyList(body: Record<string, unknown>) {
  const linked = await resolveLinkedViewer(body.phone, body.subject);
  const slug = String(body.slug ?? "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,89}$/.test(slug)) {
    throw new ControlPlaneError("INVALID_REQUEST", "Production slug is invalid.", 400);
  }
  if (typeof body.saved !== "boolean") {
    throw new ControlPlaneError("INVALID_REQUEST", "saved must be a boolean.", 400);
  }
  const production = await getProductionBySlug(slug, false);
  if (!production || production.status !== "published") {
    throw new ControlPlaneError("CONTENT_UNAVAILABLE", "Content is unavailable.", 404);
  }
  if (body.saved) await addToMyList(linked.user.id, production.id);
  else await removeFromMyList(linked.user.id, production.id);
  return { version: CONTROL_PLANE_VERSION, ok: true, slug, saved: body.saved };
}

async function requirePlaybackSubscription(userId: string) {
  const subscription = await getViewerSubscription(userId);
  if (!subscription || subscription.status !== "active" || new Date(subscription.current_period_end).getTime() <= Date.now()) {
    throw new ControlPlaneError("SUBSCRIPTION_REQUIRED", "Active subscription is required.", 403);
  }
  return subscription;
}

function playbackMovie(production: Production) {
  if (production.status !== "published" || production.content_type !== "film") {
    throw new ControlPlaneError("CONTENT_UNAVAILABLE", "Content is unavailable.", 404);
  }
  if (!production.youtube_id) {
    throw new ControlPlaneError("PLAYBACK_UNAVAILABLE", "Playback is unavailable.", 409);
  }
  return { provider: "youtube", kind: "movie", videoId: production.youtube_id, title: production.title };
}

async function playbackEpisode(episode: Episode) {
  if (episode.status !== "published" || !episode.youtube_id) {
    throw new ControlPlaneError(
      episode.status !== "published" ? "CONTENT_UNAVAILABLE" : "PLAYBACK_UNAVAILABLE",
      episode.status !== "published" ? "Content is unavailable." : "Playback is unavailable.",
      episode.status !== "published" ? 404 : 409,
    );
  }
  const rows = await controlRestRequest<Production[]>(
    `majestic_productions?select=*&id=eq.${encodeURIComponent(episode.production_id)}&limit=1`,
  );
  const parent = rows[0] ?? null;
  if (!parent || parent.status !== "published" || parent.content_type !== "series") {
    throw new ControlPlaneError("CONTENT_UNAVAILABLE", "Content is unavailable.", 404);
  }
  return {
    provider: "youtube",
    kind: "episode",
    videoId: episode.youtube_id,
    title: episode.title,
    seriesTitle: parent.title,
    seasonNumber: episode.season_number,
    episodeNumber: episode.episode_number,
  };
}

export async function authorizeFiveMPlayback(body: Record<string, unknown>) {
  const linked = await resolveLinkedViewer(body.phone, body.subject);
  await requirePlaybackSubscription(linked.user.id);
  if (!body.target || typeof body.target !== "object" || Array.isArray(body.target)) {
    throw new ControlPlaneError("INVALID_REQUEST", "Playback target is invalid.", 400);
  }
  const target = body.target as Record<string, unknown>;
  if (target.kind === "movie") {
    const slug = String(target.slug ?? "").trim().toLowerCase();
    if (!slug) throw new ControlPlaneError("INVALID_REQUEST", "Movie slug is required.", 400);
    const production = await getProductionBySlug(slug, false);
    if (!production) throw new ControlPlaneError("CONTENT_UNAVAILABLE", "Content is unavailable.", 404);
    return { version: CONTROL_PLANE_VERSION, ok: true, playback: playbackMovie(production) };
  }
  if (target.kind === "episode") {
    const episodeId = String(target.episodeId ?? "").trim();
    if (!/^[0-9a-fA-F-]{36}$/.test(episodeId)) {
      throw new ControlPlaneError("INVALID_REQUEST", "episodeId is invalid.", 400);
    }
    const episode = await getEpisodeById(episodeId, false);
    if (!episode) throw new ControlPlaneError("CONTENT_UNAVAILABLE", "Content is unavailable.", 404);
    return { version: CONTROL_PLANE_VERSION, ok: true, playback: await playbackEpisode(episode) };
  }
  throw new ControlPlaneError("INVALID_REQUEST", "Playback target kind is invalid.", 400);
}
