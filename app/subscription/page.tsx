import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentViewer } from "@/lib/user-auth";
import { getSubscriptionPlans, getViewerSubscription, getViewerWallet } from "@/lib/billing";
import SubscriptionClient from "./SubscriptionClient";
import styles from "./subscription.module.css";

export const dynamic = "force-dynamic";

export default async function SubscriptionPage() {
  const viewer = await getCurrentViewer();
  if (!viewer) redirect("/account?next=/subscription");

  const [plans, subscription, wallet] = await Promise.all([
    getSubscriptionPlans(),
    getViewerSubscription(viewer.id),
    getViewerWallet(viewer.id),
  ]);

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Link className={styles.brand} href="/">MAJESTIC<span>+</span></Link>
        <div className={styles.headerLinks}><Link href="/account">Konto</Link><Link href="/">Serwis</Link></div>
      </header>
      <section className={styles.shell}>
        <span className={styles.eyebrow}>MAJESTIC+ MEMBERSHIP</span>
        <h1>Wybierz swój plan</h1>
        <p className={styles.lead}>Subskrypcja odblokowuje odtwarzanie całego katalogu. Wszystkie kwoty są IC i zostają zapisane w historii transakcji konta.</p>
        {subscription?.status === "active" && (
          <div className={styles.current}>Aktywna subskrypcja: <strong>{subscription.plan?.name ?? "Majestic+"}</strong> · ważna do {new Date(subscription.current_period_end).toLocaleDateString("pl-PL")}</div>
        )}
        <SubscriptionClient plans={plans} activePlanCode={subscription?.status === "active" ? subscription.plan?.code : null} walletBalance={wallet?.balance ?? 0} />
      </section>
    </main>
  );
}
