import Link from "next/link";
import { rows, titles } from "@/lib/catalog";

export default function Home() {
  const featured = titles.find((item) => item.slug === "vinewood-nights")!;

  return (
    <main>
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Majestic+ home">
          <span className="brand-main">MAJESTIC</span><span className="brand-plus">+</span>
        </Link>
        <nav className="navlinks" aria-label="Główna nawigacja">
          <Link className="active" href="/">Strona główna</Link>
          <a href="#filmy">Filmy</a>
          <a href="#seriale">Seriale</a>
          <a href="#originals">Originals</a>
        </nav>
        <div className="nav-actions">
          <Link className="icon-button" href="/search" aria-label="Szukaj">⌕</Link>
          <button className="profile" aria-label="Profil">RM</button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-noise" />
        <div className="hero-city" />
        <div className="hero-shadow" />
        <div className="hero-content">
          <div className="eyebrow">A MAJESTIC+ ORIGINAL</div>
          <h1>VINEWOOD<br /><span>NIGHTS</span></h1>
          <div className="hero-meta">
            <span className="match">{featured.match} match</span>
            <span>{featured.year}</span>
            <span className="rating">{featured.maturity}</span>
            <span>{featured.runtime}</span>
            <span>{featured.quality}</span>
          </div>
          <p>{featured.description}</p>
          <div className="hero-buttons">
            <Link className="primary-btn" href={`/title/${featured.slug}`}><span>▶</span> Oglądaj</Link>
            <button className="secondary-btn"><span>＋</span> Moja lista</button>
          </div>
        </div>
        <div className="hero-credit">RICHARDS MAJESTIC STUDIOS</div>
      </section>

      <section className="catalog" id="filmy">
        <div className="spotlight-bar">
          <span className="spotlight-kicker">MAJESTIC PREMIERE</span>
          <strong>Nowe historie. Prosto z Vinewood.</strong>
          <span className="spotlight-copy">Ekskluzywne premiery Richards Majestic dostępne tylko tutaj.</span>
        </div>

        {rows.map((row, rowIndex) => (
          <section className="content-row" key={row.title} id={rowIndex === 1 ? "originals" : undefined}>
            <div className="row-heading">
              <h2>{row.title}</h2>
              <button>Zobacz wszystko <span>›</span></button>
            </div>
            <div className="card-track">
              {row.slugs.map((slug, index) => {
                const item = titles.find((entry) => entry.slug === slug)!;
                return (
                  <Link className={`movie-card ${item.posterClass}`} href={`/title/${item.slug}`} key={item.slug}>
                    <div className="card-art">
                      <div className="studio-mark">RM</div>
                      {item.original && <div className="original-badge">M+</div>}
                      <div className="card-index">{String(index + 1).padStart(2, "0")}</div>
                      <div className="card-copy">
                        <h3>{item.title}</h3>
                        <span>{item.meta}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </section>

      <section className="feature-strip" id="seriale">
        <div>
          <span>RICHARDS MAJESTIC PRESENTS</span>
          <h2>The city is watching.</h2>
          <p>Największe premiery Los Santos, produkcje oryginalne i archiwum Vinewood w jednym miejscu.</p>
        </div>
        <a className="outline-btn" href="#filmy">Przeglądaj katalog</a>
      </section>

      <footer>
        <div className="footer-brand"><span>MAJESTIC</span><b>+</b></div>
        <p>Streaming by Richards Majestic Studios.</p>
        <div className="footer-links">
          <a href="#">Pomoc</a>
          <a href="#">Warunki</a>
          <a href="#">Prywatność</a>
          <a href="#">Kontakt</a>
        </div>
        <small>© 2026 Richards Majestic Studios. All rights reserved.</small>
      </footer>
    </main>
  );
}
