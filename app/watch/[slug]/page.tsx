import Link from "next/link";
import { notFound } from "next/navigation";
import { getViewTitle } from "@/lib/content";
import { titles } from "@/lib/catalog";
import { youtubeEmbedUrl } from "@/lib/youtube";

export function generateStaticParams() {
  return titles.map((item) => ({ slug: item.slug }));
}

export const dynamicParams = true;
export const dynamic = "force-dynamic";

export default async function WatchPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = await getViewTitle(slug);

  if (!item) notFound();

  const embedUrl = item.youtubeId ? youtubeEmbedUrl(item.youtubeId) : null;

  return (
    <main style={{ minHeight: "100vh", background: "#030304", display: "flex", flexDirection: "column" }}>
      <header style={{ height: 72, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 3vw", borderBottom: "1px solid rgba(255,255,255,.08)", background: "#050507" }}>
        <Link className="brand" href="/">
          <span className="brand-main">MAJESTIC</span><span className="brand-plus">+</span>
        </Link>
        <Link href={`/title/${item.slug}`} style={{ color: "#aaa7a0", fontSize: 14 }}>← Wróć do produkcji</Link>
      </header>

      <section style={{ flex: 1, display: "grid", placeItems: "center", padding: "4vw" }}>
        <div style={{ width: "min(100%, 1380px)" }}>
          <div style={{ aspectRatio: "16/9", border: "1px solid rgba(255,255,255,.08)", background: "#000", position: "relative", overflow: "hidden", boxShadow: "0 30px 100px rgba(0,0,0,.55)" }}>
            {embedUrl ? (
              <iframe
                src={embedUrl}
                title={item.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                style={{ width: "100%", height: "100%", border: 0, display: "block" }}
              />
            ) : (
              <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center", padding: 30, background: item.thumbnailUrl ? `linear-gradient(rgba(0,0,0,.72),rgba(0,0,0,.86)),url("${item.thumbnailUrl}") center/cover` : "radial-gradient(circle at 50% 45%, rgba(134,29,45,.25), transparent 30%), linear-gradient(135deg,#111115,#050506)" }}>
                <div>
                  <div style={{ fontSize: 42, marginBottom: 14 }}>▶</div>
                  <strong>Materiał nie został jeszcze podpięty.</strong>
                  <p style={{ color: "#888", marginBottom: 0 }}>Dodaj link YouTube w panelu /studio.</p>
                </div>
              </div>
            )}
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
