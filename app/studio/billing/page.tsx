import Link from "next/link";
import { redirect } from "next/navigation";
import { isStudioAuthenticated } from "@/lib/studio-auth";
import { adminBillingOverview } from "@/lib/billing";

export const dynamic = "force-dynamic";

export default async function StudioBillingPage() {
  if (!(await isStudioAuthenticated())) redirect("/studio");

  let data: Awaited<ReturnType<typeof adminBillingOverview>> | null = null;
  let error = "";
  try {
    data = await adminBillingOverview();
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Nie udało się pobrać danych billingowych.";
  }

  const activeSubscriptions = data?.subscriptions.filter((item) => item.status === "active" && new Date(item.current_period_end).getTime() > Date.now()) ?? [];
  const completedRevenue = data?.transactions
    .filter((item) => item.status === "completed" && item.transaction_type === "subscription_purchase" && item.direction === "debit")
    .reduce((sum, item) => sum + item.amount, 0) ?? 0;
  const walletTotal = data?.wallets.reduce((sum, wallet) => sum + wallet.balance, 0) ?? 0;

  return (
    <main style={{ minHeight: "100vh", background: "radial-gradient(circle at 80% 10%,rgba(189,139,48,.12),transparent 30rem),linear-gradient(180deg,#05070b,#080a0f)", color: "#f3efe6" }}>
      <header style={{ height: 76, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4vw", borderBottom: "1px solid rgba(255,255,255,.07)", background: "rgba(4,6,9,.88)", position: "sticky", top: 0, zIndex: 20, backdropFilter: "blur(12px)" }}>
        <Link href="/studio" style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 900, letterSpacing: ".11em", fontSize: 24 }}>MAJESTIC<span style={{ color: "#e0b75f" }}>+</span> <small style={{ fontFamily: "inherit", fontSize: 9, color: "#caa44f", letterSpacing: ".16em" }}>BILLING</small></Link>
        <Link href="/studio" style={{ color: "#aaa7a0", fontSize: 13 }}>← Panel treści</Link>
      </header>

      <section style={{ width: "min(1450px,92vw)", margin: "0 auto", padding: "52px 0 90px" }}>
        <div style={{ marginBottom: 28 }}>
          <span style={{ color: "#e0b75f", fontSize: 10, fontWeight: 900, letterSpacing: ".2em" }}>RICHARDS MAJESTIC REVENUE SYSTEM</span>
          <h1 style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 500, fontSize: "clamp(42px,5vw,68px)", margin: "9px 0 10px" }}>Subskrypcje i transakcje</h1>
          <p style={{ color: "#aaa7a0", lineHeight: 1.7, maxWidth: 760 }}>Panel IC. Obecny Majestic Wallet jest warstwą testową przed podpięciem ekonomii FiveM i LB-Phone.</p>
        </div>

        {error ? (
          <div style={{ padding: 18, borderRadius: 10, border: "1px solid rgba(207,75,83,.3)", background: "rgba(155,38,45,.18)", color: "#ffb9bd" }}>
            {error}<br /><small>Jeżeli migracja billingowa nie była jeszcze uruchomiona, wykonaj <code>supabase/migration-v4-billing.sql</code>.</small>
          </div>
        ) : data && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12, marginBottom: 34 }}>
              {[
                ["AKTYWNE SUBSKRYPCJE", activeSubscriptions.length],
                ["PRZYCHÓD IC", `$${completedRevenue.toLocaleString("en-US")}`],
                ["KONTA WIDZÓW", data.profiles.length],
                ["ŚRODKI W PORTFELACH", `$${walletTotal.toLocaleString("en-US")}`],
              ].map(([label, value]) => <div key={String(label)} style={{ padding: 20, border: "1px solid rgba(255,255,255,.08)", borderRadius: 11, background: "rgba(255,255,255,.025)" }}><span style={{ color: "#8d8980", fontSize: 9, fontWeight: 900, letterSpacing: ".14em" }}>{label}</span><strong style={{ display: "block", marginTop: 8, fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 32, fontWeight: 500, color: "#f0c971" }}>{value}</strong></div>)}
            </div>

            <section style={{ marginBottom: 36 }}>
              <h2 style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 32, fontWeight: 500, margin: "0 0 14px" }}>Aktywne subskrypcje</h2>
              <div style={{ display: "grid", gap: 9 }}>
                {activeSubscriptions.map((subscription) => (
                  <div key={subscription.id} style={{ display: "grid", gridTemplateColumns: "1.3fr .8fr .8fr .8fr", gap: 14, alignItems: "center", padding: "14px 16px", border: "1px solid rgba(255,255,255,.07)", borderRadius: 9, background: "#0a0d12" }}>
                    <div><strong>{subscription.profile?.display_name ?? subscription.user_id.slice(0, 8)}</strong><small style={{ display: "block", color: "#66645f", marginTop: 4 }}>{subscription.user_id}</small></div>
                    <div><span style={{ color: "#77736c", fontSize: 10 }}>PLAN</span><strong style={{ display: "block", color: "#e1bb68", marginTop: 4 }}>{subscription.plan?.name ?? "Majestic+"}</strong></div>
                    <div><span style={{ color: "#77736c", fontSize: 10 }}>WAŻNA DO</span><strong style={{ display: "block", marginTop: 4 }}>{new Date(subscription.current_period_end).toLocaleDateString("pl-PL")}</strong></div>
                    <div><span style={{ color: "#77736c", fontSize: 10 }}>SALDO</span><strong style={{ display: "block", marginTop: 4 }}>${subscription.wallet?.balance ?? 0}</strong></div>
                  </div>
                ))}
                {!activeSubscriptions.length && <div style={{ padding: 30, color: "#706d66", border: "1px dashed rgba(255,255,255,.1)", borderRadius: 9 }}>Brak aktywnych subskrypcji.</div>}
              </div>
            </section>

            <section>
              <h2 style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 32, fontWeight: 500, margin: "0 0 14px" }}>Ostatnie transakcje</h2>
              <div style={{ display: "grid", gap: 8 }}>
                {data.transactions.slice(0, 50).map((transaction) => (
                  <div key={transaction.id} style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr .6fr .7fr", gap: 12, alignItems: "center", padding: "13px 15px", border: "1px solid rgba(255,255,255,.07)", borderRadius: 8, background: "#090c11" }}>
                    <div><strong>{transaction.profile?.display_name ?? transaction.user_id.slice(0, 8)}</strong><small style={{ display: "block", color: "#6f6c65", marginTop: 4 }}>{new Date(transaction.created_at).toLocaleString("pl-PL")}</small></div>
                    <div style={{ color: "#bbb6ac", fontSize: 13 }}>{transaction.description || transaction.transaction_type}</div>
                    <div style={{ color: transaction.status === "completed" ? "#87d29b" : "#e0a7a7", fontSize: 10, fontWeight: 900 }}>{transaction.status.toUpperCase()}</div>
                    <strong style={{ textAlign: "right", color: transaction.direction === "debit" ? "#f1c36b" : "#8ed2a1", fontSize: 18 }}>{transaction.direction === "debit" ? "−" : "+"}${transaction.amount}</strong>
                  </div>
                ))}
                {!data.transactions.length && <div style={{ padding: 30, color: "#706d66", border: "1px dashed rgba(255,255,255,.1)", borderRadius: 9 }}>Brak transakcji.</div>}
              </div>
            </section>
          </>
        )}
      </section>
    </main>
  );
}
