"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ViewTitle } from "@/lib/content";

export default function SearchClient({ titles }: { titles: ViewTitle[] }) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return titles;
    return titles.filter((item) =>
      `${item.title} ${item.genre} ${item.meta} ${item.year}`.toLowerCase().includes(value),
    );
  }, [query, titles]);

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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 12 }}>
          {results.map((item) => (
            <Link href={`/title/${item.slug}`} key={item.slug} style={{ position: "relative", aspectRatio: "16/9", overflow: "hidden", borderRadius: 8, border: "1px solid rgba(255,255,255,.08)", background: item.thumbnailUrl ? `linear-gradient(180deg,transparent 30%,rgba(0,0,0,.88)),url("${item.thumbnailUrl}") center/cover` : "linear-gradient(135deg,#182536,#0a0f15)", display: "flex", alignItems: "flex-end", padding: 14 }}>
              <span style={{ position: "absolute", top: 10, left: 11, fontFamily: "Georgia,serif", fontSize: 10, fontWeight: 900 }}>RM</span>
              {item.original && <span style={{ position: "absolute", top: 8, right: 8, padding: "4px 6px", border: "1px solid #b89349", color: "#e6c474", fontSize: 8, fontWeight: 900 }}>M+</span>}
              <div style={{ position: "relative", zIndex: 2 }}>
                <h3 style={{ margin: 0, fontSize: 20, textTransform: "uppercase", lineHeight: .95 }}>{item.title}</h3>
                <span style={{ display: "block", marginTop: 7, color: "rgba(255,255,255,.72)", fontSize: 11 }}>{item.meta}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
