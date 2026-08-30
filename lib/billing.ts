import { supabaseBaseUrl, supabaseServiceKey } from "@/lib/majestic-db";

export type SubscriptionPlan = {
  id: string;
  code: string;
  name: string;
  price: number;
  currency: string;
  billing_days: number;
  max_devices: number;
  quality: string;
  features: string[];
  active: boolean;
  display_order: number;
};

export type ViewerWallet = {
  user_id: string;
  balance: number;
  currency: string;
  updated_at: string;
};

export type ViewerSubscription = {
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
  plan?: SubscriptionPlan;
};

export type ViewerTransaction = {
  id: string;
  user_id: string;
  plan_id: string | null;
  transaction_type: "subscription_purchase" | "wallet_credit" | "refund" | "admin_adjustment";
  direction: "debit" | "credit";
  amount: number;
  currency: string;
  status: "completed" | "failed" | "refunded";
  description: string;
  external_reference: string | null;
  created_at: string;
};

const restBaseUrl = supabaseBaseUrl ? `${supabaseBaseUrl}/rest/v1` : "";

function ready() {
  return Boolean(restBaseUrl && supabaseServiceKey);
}

function headers(init?: HeadersInit) {
  const result = new Headers(init);
  result.set("apikey", supabaseServiceKey);
  result.set("Authorization", `Bearer ${supabaseServiceKey}`);
  result.set("Content-Type", "application/json");
  return result;
}

async function request(path: string, init?: RequestInit) {
  if (!ready()) throw new Error("Supabase is not configured");
  const response = await fetch(`${restBaseUrl}/${path.replace(/^\/+/, "")}`, {
    ...init,
    headers: headers(init?.headers),
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) {
    let message = text;
    try {
      const data = text ? JSON.parse(text) : {};
      message = data?.message || data?.details || data?.hint || text;
    } catch {}
    throw new Error(message || `Supabase ${response.status}`);
  }
  return text ? JSON.parse(text) : null;
}

export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  if (!ready()) return [];
  return (await request("majestic_subscription_plans?select=*&active=eq.true&order=display_order.asc")) as SubscriptionPlan[];
}

export async function getViewerWallet(userId: string): Promise<ViewerWallet | null> {
  if (!ready()) return null;
  const rows = (await request(`majestic_wallets?select=*&user_id=eq.${encodeURIComponent(userId)}&limit=1`)) as ViewerWallet[];
  return rows[0] ?? null;
}

export async function getViewerSubscription(userId: string): Promise<ViewerSubscription | null> {
  if (!ready()) return null;
  const rows = (await request(
    `majestic_subscriptions?select=*&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
  )) as ViewerSubscription[];
  const subscription = rows[0] ?? null;
  if (!subscription) return null;

  if (subscription.status === "active" && new Date(subscription.current_period_end).getTime() <= Date.now()) {
    await request(`majestic_subscriptions?id=eq.${encodeURIComponent(subscription.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: "expired", updated_at: new Date().toISOString() }),
    });
    return { ...subscription, status: "expired" };
  }

  const plans = await getSubscriptionPlans();
  return { ...subscription, plan: plans.find((plan) => plan.id === subscription.plan_id) };
}

export async function hasActiveSubscription(userId: string) {
  const subscription = await getViewerSubscription(userId);
  return Boolean(
    subscription &&
    subscription.status === "active" &&
    new Date(subscription.current_period_end).getTime() > Date.now(),
  );
}

export async function getViewerTransactions(userId: string, limit = 25): Promise<ViewerTransaction[]> {
  if (!ready()) return [];
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 25));
  return (await request(
    `majestic_transactions?select=*&user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=${safeLimit}`,
  )) as ViewerTransaction[];
}

export async function purchaseSubscription(userId: string, planCode: string) {
  if (!ready()) throw new Error("Supabase is not configured");
  const response = await fetch(`${restBaseUrl}/rpc/purchase_majestic_subscription`, {
    method: "POST",
    headers: headers(),
    cache: "no-store",
    body: JSON.stringify({ p_user_id: userId, p_plan_code: planCode }),
  });
  const text = await response.text();
  if (!response.ok) {
    let message = text;
    try {
      const data = text ? JSON.parse(text) : {};
      message = data?.message || data?.details || data?.hint || text;
    } catch {}
    throw new Error(message || "Nie udało się aktywować subskrypcji.");
  }
  return text ? JSON.parse(text) : { ok: true };
}

export async function adminBillingOverview() {
  const [plans, subscriptions, transactions, wallets, profiles] = await Promise.all([
    getSubscriptionPlans(),
    request("majestic_subscriptions?select=*&order=created_at.desc") as Promise<ViewerSubscription[]>,
    request("majestic_transactions?select=*&order=created_at.desc&limit=100") as Promise<ViewerTransaction[]>,
    request("majestic_wallets?select=*&order=updated_at.desc") as Promise<ViewerWallet[]>,
    request("majestic_profiles?select=id,display_name,created_at&order=created_at.desc") as Promise<Array<{ id: string; display_name: string; created_at: string }>>,
  ]);

  const planById = new Map(plans.map((plan) => [plan.id, plan]));
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const walletById = new Map(wallets.map((wallet) => [wallet.user_id, wallet]));

  return {
    plans,
    subscriptions: subscriptions.map((subscription) => ({
      ...subscription,
      plan: planById.get(subscription.plan_id) ?? null,
      profile: profileById.get(subscription.user_id) ?? null,
      wallet: walletById.get(subscription.user_id) ?? null,
    })),
    transactions: transactions.map((transaction) => ({
      ...transaction,
      plan: transaction.plan_id ? planById.get(transaction.plan_id) ?? null : null,
      profile: profileById.get(transaction.user_id) ?? null,
    })),
    wallets,
    profiles,
  };
}
