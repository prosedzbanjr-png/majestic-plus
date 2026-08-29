import Link from "next/link";
import { notFound } from "next/navigation";
import { getTitle, titles } from "@/lib/catalog";

export function generateStaticParams() {
  return titles.map((item) => ({ slug: item.slug }));
}

export default async function WatchPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = getTitle(slug);

  if (!item) notFound();

  return (
    <main style={{ minHeight: "100vh", background: "#030304", display: "flex", flexDirection: "column" }}>
      <header style={{ height: 72, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 3vw", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
        <Link className="brand" href="/">
          <span className="brand-main">MAJESTIC</span><span className="brand-plus">+</span>
        </Link>
        <Link href={`/title/${item.slug}`} style={{ color: "#aaa7a0", fontSize: 14 }}>← Wróć do produkcji</Link>
      </header>

      <section style={{ flex: 1, display: "grid", placeItems: "center", padding: "5vw" }}>
        <div style={{ width: "min(100%, 1280px)" }}>
          <div style={{ aspectRatio: "16/9", border: "1px solid rgba(255,255,255,.08)", background: "radial-gradient(circle at 50% 45%, rgba(134,29,45,.25), transparent 30%), linear-gradient(135deg,#111115,#050506)", display: "grid", placeItems: "center", position: "relative" }}>
            <button className="primary-btn" style={{ borderRadius: 999, width: 76, height: 76, padding: 0, fontSize: 25 }} aria-label="Odtwórz">▶</button>
            <span style={{ position: "absolute", bottom: 18, left: 20, color: "rgba(255,255,255,.55)", fontSize: 12, letterSpacing: ".14em" }}>PLAYER READY FOR MEDIA SOURCE</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 30, alignItems: "flex-start", marginTop: 24 }}>
            <div>
              <span className="spotlight-kicker">NOW PLAYING</span>
              <h1 style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: "clamp(34px,4vw,58px)", margin: "8px 0" }}>{item.title}</h1>
              <p style={{ color: "#aaa7a0", margin: 0 }}>{item.year} · {item.maturity} · {item.runtime} · {item.quality}</p>
            </div>
            <button className="secondary-btn">＋ Moja lista</button>
          </div>
        </div>
      </section>
    </main>
  );
}
