const rows = [
  {
    title: "Popularne teraz",
    items: [
      ["Vinewood Nights", "Crime · 2026", "poster red"],
      ["Pacific Standard", "Thriller · 2026", "poster gold"],
      ["The Last Take", "Drama · 2025", "poster blue"],
      ["San Andreas", "Action · 2026", "poster orange"],
      ["After Hours", "Mystery · 2025", "poster purple"],
      ["Mirror Park", "Comedy · 2026", "poster green"],
    ],
  },
  {
    title: "Majestic+ Originals",
    items: [
      ["Red Carpet", "Original · Drama", "poster crimson"],
      ["Southbound", "Original · Crime", "poster slate"],
      ["Studio 4", "Original · Documentary", "poster amber"],
      ["No Signal", "Original · Thriller", "poster navy"],
      ["Boulevard", "Original · Romance", "poster wine"],
      ["The Producer", "Original · Drama", "poster bronze"],
    ],
  },
  {
    title: "Klasyki Vinewood",
    items: [
      ["Meltdown", "Classic · 2013", "poster mono"],
      ["Deep Inside", "Classic · 2013", "poster teal"],
      ["Capolavoro", "Classic · 2012", "poster ivory"],
      ["The Simian", "Classic · 2011", "poster moss"],
      ["An American Divorce", "Classic · 2010", "poster dusk"],
      ["Water Torture IX", "Classic · Horror", "poster black"],
    ],
  },
];

export default function Home() {
  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#" aria-label="Majestic+ home">
          <span className="brand-main">MAJESTIC</span><span className="brand-plus">+</span>
        </a>
        <nav className="navlinks" aria-label="Główna nawigacja">
          <a className="active" href="#">Strona główna</a>
          <a href="#filmy">Filmy</a>
          <a href="#seriale">Seriale</a>
          <a href="#originals">Originals</a>
        </nav>
        <div className="nav-actions">
          <button className="icon-button" aria-label="Szukaj">⌕</button>
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
            <span className="match">98% match</span>
            <span>2026</span>
            <span className="rating">18+</span>
            <span>2h 07m</span>
            <span>4K</span>
          </div>
          <p>
            Gdy światła premier gasną, zaczyna się prawdziwe Vinewood. Młody producent
            odkrywa układ, który może wynieść go na szczyt albo pogrzebać całe studio.
          </p>
          <div className="hero-buttons">
            <button className="primary-btn"><span>▶</span> Oglądaj</button>
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
              {row.items.map(([title, meta, className], index) => (
                <article className={`movie-card ${className}`} key={title}>
                  <div className="card-art">
                    <div className="studio-mark">RM</div>
                    {rowIndex === 1 && <div className="original-badge">M+</div>}
                    <div className="card-index">{String(index + 1).padStart(2, "0")}</div>
                    <div className="card-copy">
                      <h3>{title}</h3>
                      <span>{meta}</span>
                    </div>
                  </div>
                </article>
              ))}
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
        <button className="outline-btn">Przeglądaj katalog</button>
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
