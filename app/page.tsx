import Link from "next/link";
import { rows, titles } from "@/lib/catalog";
import styles from "./home.module.css";

export default function Home() {
  const featured = titles.find((item) => item.slug === "vinewood-nights")!;

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Link className={styles.brand} href="/" aria-label="Majestic+ home">
          <span className={styles.brandMain}>MAJESTIC</span>
          <span className={styles.brandPlus}>+</span>
        </Link>

        <nav className={styles.nav} aria-label="Główna nawigacja">
          <Link className={styles.active} href="/">Strona główna</Link>
          <a href="#filmy">Filmy</a>
          <a href="#seriale">Seriale</a>
          <a href="#originals">Originals</a>
          <a href="#moja-lista">Moja lista</a>
        </nav>

        <div className={styles.actions}>
          <Link className={styles.search} href="/search" aria-label="Szukaj">
            <span className={styles.searchIcon}>⌕</span>
            <span>Szukaj</span>
          </Link>
          <button className={styles.profile} aria-label="Profil">RM</button>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroArtwork} />
        <div className={styles.heroShade} />
        <div className={styles.heroGrain} />

        <button className={`${styles.arrow} ${styles.arrowLeft}`} aria-label="Poprzednia produkcja">‹</button>
        <button className={`${styles.arrow} ${styles.arrowRight}`} aria-label="Następna produkcja">›</button>

        <div className={styles.heroContent}>
          <div className={styles.original}>MAJESTIC+ ORIGINAL</div>
          <h1 className={styles.heroTitle}>
            <span>VINEWOOD</span>
            <span>NIGHTS</span>
          </h1>

          <div className={styles.meta}>
            <span className={styles.match}>{featured.match} match</span>
            <span>{featured.year}</span>
            <span className={styles.maturity}>{featured.maturity}</span>
            <span>{featured.runtime}</span>
            <span>{featured.quality}</span>
          </div>

          <p className={styles.description}>{featured.description}</p>

          <div className={styles.heroButtons}>
            <Link className={styles.primary} href={`/watch/${featured.slug}`}>
              <span>▶</span>
              Oglądaj
            </Link>
            <button className={styles.secondary}>
              <span>＋</span>
              Moja lista
            </button>
          </div>
        </div>

        <div className={styles.pager} aria-hidden="true">
          <span className={styles.pagerActive} />
          <span />
          <span />
          <span />
        </div>
      </section>

      <section className={styles.catalog} id="filmy">
        {rows.map((row, rowIndex) => (
          <section
            className={styles.row}
            key={row.title}
            id={rowIndex === 1 ? "originals" : rowIndex === 2 ? "seriale" : undefined}
          >
            <div className={styles.rowHeader}>
              <h2>{row.title}</h2>
              <Link href="/search">Zobacz wszystko ›</Link>
            </div>

            <div className={styles.track}>
              {row.slugs.map((slug) => {
                const item = titles.find((entry) => entry.slug === slug)!;

                return (
                  <Link
                    className={styles.card}
                    href={`/title/${item.slug}`}
                    key={item.slug}
                    aria-label={`${item.title}, ${item.meta}`}
                  >
                    <div className={styles.cardBackdrop} />
                    <span className={styles.cardBrand}>RM</span>
                    {item.original && <span className={styles.originalBadge}>M+</span>}
                    <div className={styles.cardCopy}>
                      <h3>{item.title}</h3>
                      <span>{item.meta}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </section>

      <footer className={styles.footer} id="moja-lista">
        <strong>MAJESTIC+</strong> · Streaming by Richards Majestic Studios · © 2026
      </footer>
    </main>
  );
}
