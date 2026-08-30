"use client";

import { useState } from "react";
import type { SubscriptionPlan } from "@/lib/billing";
import styles from "./subscription.module.css";

export default function SubscriptionClient({
  plans,
  activePlanCode,
  walletBalance,
}: {
  plans: SubscriptionPlan[];
  activePlanCode?: string | null;
  walletBalance: number;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function buy(plan: SubscriptionPlan) {
    if (!window.confirm(`Aktywować Majestic+ ${plan.name} za $${plan.price} na ${plan.billing_days} dni?`)) return;
    setLoading(plan.code);
    setMessage("");
    setError("");

    const response = await fetch("/api/subscriptions/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_code: plan.code }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error ?? "Nie udało się kupić subskrypcji.");
      setLoading(null);
      return;
    }

    setMessage(`Majestic+ ${plan.name} aktywne. Przekierowuję do konta...`);
    setLoading(null);
    window.setTimeout(() => { window.location.href = "/account"; }, 700);
  }

  return (
    <div>
      <div className={styles.wallet}>Saldo IC: <strong>${walletBalance.toLocaleString("en-US")}</strong><span>Majestic Wallet · tymczasowo przed integracją LB-Phone</span></div>
      {message && <div className={styles.success}>{message}</div>}
      {error && <div className={styles.error}>{error}</div>}
      <div className={styles.plans}>
        {plans.map((plan) => {
          const active = activePlanCode === plan.code;
          const canAfford = walletBalance >= plan.price;
          return (
            <article className={`${styles.plan} ${active ? styles.planActive : ""}`} key={plan.id}>
              <div className={styles.planTop}>
                <span className={styles.code}>{active ? "AKTYWNY PLAN" : "MAJESTIC+"}</span>
                <h2>{plan.name}</h2>
                <div className={styles.price}><strong>${plan.price}</strong><span>/ {plan.billing_days} dni</span></div>
              </div>
              <div className={styles.specs}><span>{plan.quality}</span><span>{plan.max_devices} {plan.max_devices === 1 ? "urządzenie" : "urządzenia"}</span></div>
              <ul>{(plan.features ?? []).map((feature) => <li key={feature}>{feature}</li>)}</ul>
              <button disabled={Boolean(loading) || !canAfford} onClick={() => void buy(plan)}>
                {loading === plan.code ? "AKTYWOWANIE..." : active ? `PRZEDŁUŻ ${plan.name.toUpperCase()}` : canAfford ? `WYBIERZ ${plan.name.toUpperCase()}` : "BRAK ŚRODKÓW"}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
