"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { titles } from "@/lib/catalog";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return titles;
    return titles.filter((item) =>
      `${item.title} ${item.genre} ${item.meta}`.toLowerCase().includes(value),
    );
  }, [query]);

  return (
    <main style={{ minHeight: "100vh", paddingTop: 110 }}>
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Majestic+ home">
          <span className="brand-main">MAJESTIC</span><span className="brand-plus">+</span>
        </Link>
        <nav className="navlinks">
          <Link href="/">Strona główna</Link>
          <Link href="/#filmy">Filmy</Link>
          <Link href="/#originals">Originals</Link>
        </nav>
        <div className="nav-actions"><button className="profile">RM</button></div>
      </header>

      <section className="content-row" style={{ maxWidth: 1500, margin: "0 auto" }}>
        <span className="spotlight-kicker">MAJESTIC+ SEARCH</span>
        <h1 style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: "clamp(38px,5vw,72px)", fontWeight: 500, margin: "12px 0 28px" }}>
          Znajdź produkcję
        </h1>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tytuł, gatunek, rok..."
          autoFocus
          style={{
            width: "min(100%, 760px)",
            padding: "17px 20px",
            borderRadius: 5,
            border: "1px solid rgba(255,255,255,.16)",
            outline: "none",
            background: "rgba(255,255,255,.06)",
            color: "white",
            fontSize: 17,
          }}
        />

        <p style={{ color: "#aaa7a0", margin: "22px 0" }}>{results.length} wyników</p>
        <div className="card-track" style={{ gridTemplateColumns: "repeat(4, minmax(210px, 1fr))", overflow: "visible", flexWrap: "wrap" }}>
          {results.map((item) => (
            <Link className={`movie-card ${item.posterClass}`} href={`/title/${item.slug}`} key={item.slug}>
              <div className="card-art">
                <div className="studio-mark">RM</div>
                {item.original && <div className="original-badge">M+</div>}
                <div className="card-copy">
                  <h3>{item.title}</h3>
                  <span>{item.meta}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
