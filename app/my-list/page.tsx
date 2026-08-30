import Link from "next/link";
import styles from "./my-list.module.css";
import { getCurrentViewer, viewerInitials } from "@/lib/user-auth";
import { getMyListProductions } from "@/lib/viewer-data";
import { productionToView } from "@/lib/content";

export const dynamic = "force-dynamic";

export default async function MyListPage() {
  const viewer = await getCurrentViewer();
  const items = viewer ? (await getMyListProductions(viewer.id).catch(() => [])).map(productionToView) : [];

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Link className={styles.brand} href="/">MAJESTIC<span>+</span></Link>
        <div className={styles.actions}>
          <Link href="/search">Szukaj</Link>
          <Link className={styles.profile} href="/account">{viewerInitials(viewer)}</Link>
        </div>
      </header>

      <section className={styles.shell}>
        <div className={styles.header}>
          <span className={styles.eyebrow}>TWOJA BIBLIOTEKA</span>
          <h1>Moja lista</h1>
          <p>Zapisane filmy i seriale czekają tutaj.</p>
        </div>

        {!viewer ? (
          <div className={styles.empty}>
            <h2>Zaloguj się, żeby mieć własną listę.</h2>
            <p>Po utworzeniu konta zapisane produkcje będą przypisane do Ciebie.</p>
            <Link className={styles.button} href="/account?next=/my-list">Zaloguj się / utwórz konto</Link>
          </div>
        ) : items.length ? (
          <div className={styles.grid}>
            {items.map((item) => (
              <Link className={styles.card} href={`/title/${item.slug}`} key={item.slug}>
                <div className={styles.art} style={{ backgroundImage: item.thumbnailUrl ? `url("${item.thumbnailUrl}")` : "linear-gradient(135deg,#17131a,#0b0c10)" }} />
                <div className={styles.shade} />
                {item.original && <span className={styles.badge}>M+</span>}
                <div className={styles.copy}>
                  <h2>{item.title}</h2>
                  <span>{item.meta}{item.contentType === "series" ? " · SERIAL" : ""}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className={styles.empty}>
            <h2>Na razie jest tu pusto.</h2>
            <p>Wejdź w dowolną produkcję i kliknij „Moja lista”.</p>
            <Link className={styles.button} href="/search">Przeglądaj produkcje</Link>
          </div>
        )}
      </section>
    </main>
  );
}
