import Link from "next/link";
import AuthPanel from "./AuthPanel";
import LogoutButton from "./LogoutButton";
import styles from "./account.module.css";
import { getCurrentViewer, isViewerAuthConfigured, viewerDisplayName, viewerInitials, viewerUsername } from "@/lib/user-auth";
import { getMyListIds, getViewerProfile } from "@/lib/viewer-data";

export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const nextPath = params.next?.startsWith("/") ? params.next : "/";
  const viewer = await getCurrentViewer();

  let profile = null;
  let listCount = 0;
  if (viewer) {
    try {
      [profile, listCount] = await Promise.all([
        getViewerProfile(viewer.id),
        getMyListIds(viewer.id).then((items) => items.length),
      ]);
    } catch {
      profile = null;
      listCount = 0;
    }
  }

  const displayName = profile?.display_name || viewerDisplayName(viewer);
  const username = viewerUsername(viewer);

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
          <p>{viewer ? "Twoja lista i profil są przypisane do tego konta." : "Utwórz konto widza albo zaloguj się, żeby zachowywać własną listę produkcji."}</p>
        </div>

        {!isViewerAuthConfigured() ? (
          <div className={styles.card} style={{ marginTop: 32 }}>
            <div className={styles.error}>Logowanie widzów nie jest jeszcze skonfigurowane na serwerze. Dodaj klucz publiczny Supabase do zmiennych środowiskowych.</div>
          </div>
        ) : viewer ? (
          <div className={styles.grid}>
            <div className={styles.card}>
              <div className={styles.profileCard}>
                <div className={styles.avatar}>{viewerInitials(viewer)}</div>
                <div>
                  <h2>{displayName}</h2>
                  <p>@{username}</p>
                </div>
              </div>
              <div className={styles.stat}>W Twojej liście: <strong>{listCount}</strong> {listCount === 1 ? "produkcja" : "produkcji"}</div>
              <div className={styles.actions}>
                <Link className={styles.linkButton} href="/my-list">Moja lista</Link>
                <Link className={styles.linkButton} href="/search">Szukaj produkcji</Link>
                <LogoutButton />
              </div>
            </div>
            <aside className={styles.aside}>
              <div className={styles.asideBox}><h3>Twój profil</h3><p>Logujesz się własnym loginem, a w serwisie wyświetlany jest wybrany przez Ciebie nick.</p></div>
              <div className={styles.asideBox}><h3>Moja lista</h3><p>Zapisane filmy i seriale są przypisane do konta, więc nie znikną po zmianie urządzenia.</p></div>
            </aside>
          </div>
        ) : (
          <div className={styles.grid}>
            <AuthPanel nextPath={nextPath} />
            <aside className={styles.aside}>
              <div className={styles.asideBox}><h3>Bez prawdziwego maila</h3><p>Konto Majestic+ działa na loginie i haśle. Żaden prawdziwy adres e-mail nie jest potrzebny.</p></div>
              <div className={styles.asideBox}><h3>Własna lista</h3><p>Dodawaj filmy i seriale do „Mojej listy” i wracaj do nich później.</p></div>
              <div className={styles.asideBox}><h3>Studio osobno</h3><p>Konta widzów nie dają dostępu do panelu /studio.</p></div>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
