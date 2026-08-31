import Link from "next/link";
import AuthPanel from "./AuthPanel";
import FiveMLinkPanel from "./FiveMLinkPanel";
import LogoutButton from "./LogoutButton";
import styles from "./account.module.css";
import { getCurrentViewer, isViewerAuthConfigured, viewerDisplayName, viewerInitials, viewerUsername } from "@/lib/user-auth";
import { getMyListIds, getViewerProfile } from "@/lib/viewer-data";
import { getViewerSubscription, getViewerTransactions, getViewerWallet } from "@/lib/billing";
import { getViewerFiveMLinkStatus } from "@/lib/fivem-control-plane/service";

export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const nextPath = params.next?.startsWith("/") ? params.next : "/";
  const viewer = await getCurrentViewer();

  let profile = null;
  let listCount = 0;
  let subscription = null;
  let wallet = null;
  let transactions = [] as Awaited<ReturnType<typeof getViewerTransactions>>;
  let fiveM = { configured: false, linked: false, maskedPhone: null as string | null, realm: null as string | null };

  if (viewer) {
    try {
      [profile, listCount, subscription, wallet, transactions] = await Promise.all([
        getViewerProfile(viewer.id),
        getMyListIds(viewer.id).then((items) => items.length),
        getViewerSubscription(viewer.id),
        getViewerWallet(viewer.id),
        getViewerTransactions(viewer.id, 8),
      ]);
    } catch {
      profile = null;
      listCount = 0;
      subscription = null;
      wallet = null;
      transactions = [];
    }
    try {
      fiveM = await getViewerFiveMLinkStatus(viewer.id);
    } catch {
      fiveM = { configured: false, linked: false, maskedPhone: null, realm: null };
    }
  }

  const displayName = profile?.display_name || viewerDisplayName(viewer);
  const username = viewerUsername(viewer);
  const activeSubscription = subscription?.status === "active" && new Date(subscription.current_period_end).getTime() > Date.now();

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Link className={styles.brand} href="/">MAJESTIC<span>+</span></Link>
        <Link className={styles.back} href="/">← Wróć do serwisu</Link>
      </header>

      <section className={styles.shell}>
        <div className={styles.hero}>
          <span className={styles.eyebrow}>MAJESTIC+ ACCOUNT</span>
          <h1>{viewer ? "Twoje konto" : "Wejdź do Majestic+"}</h1>
          <p>{viewer ? "Profil, subskrypcja, FiveM, transakcje i Twoja lista w jednym miejscu." : "Utwórz konto widza albo zaloguj się, żeby korzystać z Majestic+."}</p>
        </div>

        {!isViewerAuthConfigured() ? (
          <div className={styles.card} style={{ marginTop: 32 }}>
            <div className={styles.error}>Logowanie widzów nie jest jeszcze skonfigurowane na serwerze.</div>
          </div>
        ) : viewer ? (
          <>
            <div className={styles.grid}>
              <div className={styles.card}>
                <div className={styles.profileCard}>
                  <div className={styles.avatar}>{viewerInitials(viewer)}</div>
                  <div>
                    <h2>{displayName}</h2>
                    <p>@{username}</p>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10, marginTop: 18 }}>
                  <div className={styles.stat}>Moja lista<br /><strong>{listCount}</strong> {listCount === 1 ? "produkcja" : "produkcji"}</div>
                  <div className={styles.stat}>Majestic Wallet<br /><strong>${(wallet?.balance ?? 0).toLocaleString("en-US")}</strong></div>
                  <div className={styles.stat}>Subskrypcja<br /><strong>{activeSubscription ? subscription?.plan?.name ?? "Aktywna" : "Brak"}</strong></div>
                </div>

                {activeSubscription && subscription && (
                  <div style={{ marginTop: 14, padding: "13px 14px", border: "1px solid rgba(224,183,95,.26)", borderRadius: 8, background: "rgba(224,183,95,.07)", color: "#cfc1a1", fontSize: 13 }}>
                    Plan <strong style={{ color: "#f0c974" }}>{subscription.plan?.name ?? "Majestic+"}</strong> jest aktywny do <strong>{new Date(subscription.current_period_end).toLocaleDateString("pl-PL")}</strong>.
                  </div>
                )}

                <div className={styles.actions}>
                  <Link className={styles.linkButton} href="/subscription">{activeSubscription ? "Zmień / przedłuż plan" : "Wybierz subskrypcję"}</Link>
                  <Link className={styles.linkButton} href="/my-list">Moja lista</Link>
                  <Link className={styles.linkButton} href="/search">Szukaj produkcji</Link>
                  <LogoutButton />
                </div>
              </div>

              <aside className={styles.aside}>
                <div className={styles.asideBox}><h3>Majestic+ Membership</h3><p>{activeSubscription ? `Masz aktywny plan ${subscription?.plan?.name ?? "Majestic+"}. Player jest odblokowany.` : "Do oglądania produkcji potrzebujesz aktywnej subskrypcji."}</p></div>
                <div className={styles.asideBox}><h3>Majestic Wallet</h3><p>To osobny portfel WWW. Zakupy wykonywane później z FiveM będą rozliczane przez ESX i nie będą obciążać tego salda.</p></div>
              </aside>
            </div>

            <FiveMLinkPanel
              configured={fiveM.configured}
              linked={fiveM.linked}
              maskedPhone={fiveM.maskedPhone}
              realm={fiveM.realm}
              username={username}
            />

            <div className={styles.card} style={{ marginTop: 22 }}>
              <span className={styles.eyebrow}>HISTORIA PŁATNOŚCI</span>
              <h2 style={{ margin: "8px 0 18px", fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 30, fontWeight: 500 }}>Transakcje</h2>
              {transactions.length ? (
                <div style={{ display: "grid", gap: 8 }}>
                  {transactions.map((transaction) => (
                    <div key={transaction.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "center", padding: "12px 14px", background: "#090c11", border: "1px solid rgba(255,255,255,.07)", borderRadius: 8 }}>
                      <div><strong>{transaction.description || "Transakcja Majestic+"}</strong><div style={{ color: "#716f6a", fontSize: 11, marginTop: 4 }}>{new Date(transaction.created_at).toLocaleString("pl-PL")} · {transaction.status === "completed" ? "ZAKOŃCZONA" : transaction.status.toUpperCase()}</div></div>
                      <strong style={{ color: transaction.direction === "debit" ? "#f0c36a" : "#91d8a5", fontSize: 18 }}>{transaction.direction === "debit" ? "−" : "+"}${transaction.amount}</strong>
                    </div>
                  ))}
                </div>
              ) : <p style={{ color: "#7f7c75", margin: 0 }}>Brak transakcji.</p>}
            </div>
          </>
        ) : (
          <div className={styles.grid}>
            <AuthPanel nextPath={nextPath} />
            <aside className={styles.aside}>
              <div className={styles.asideBox}><h3>Bez prawdziwego maila</h3><p>Konto Majestic+ działa na loginie i haśle. Żaden prawdziwy adres e-mail nie jest potrzebny.</p></div>
              <div className={styles.asideBox}><h3>Subskrypcja</h3><p>Po zalogowaniu wybierasz plan IC i odblokowujesz odtwarzanie katalogu.</p></div>
              <div className={styles.asideBox}><h3>Studio osobno</h3><p>Konta widzów nie dają dostępu do panelu /studio.</p></div>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
