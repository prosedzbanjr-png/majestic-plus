import Link from "next/link";
import { notFound } from "next/navigation";
import { getViewEpisodes, getViewTitle } from "@/lib/content";
import { titles } from "@/lib/catalog";
import { getEpisodeById } from "@/lib/majestic-db";
import { isStudioAuthenticated } from "@/lib/studio-auth";
import { getCurrentViewer } from "@/lib/user-auth";
import { hasActiveSubscription } from "@/lib/billing";
import { youtubeEmbedUrl } from "@/lib/youtube";
import MyListButton from "@/components/MyListButton";

export function generateStaticParams() { return titles.map((item) => ({ slug: item.slug })); }
export const dynamicParams = true;
export const dynamic = "force-dynamic";

export default async function WatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ episode?: string; preview?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const preview = query.preview === "1" && (await isStudioAuthenticated());
  const item = await getViewTitle(slug, preview);
  if (!item) notFound();

  const viewer = preview ? null : await getCurrentViewer();
  const subscribed = preview || Boolean(viewer && await hasActiveSubscription(viewer.id));

  if (!subscribed) {
    return (
      <main style={{ minHeight: "100vh", background: "#030304", color: "#f3efe6", display: "flex", flexDirection: "column" }}>
        <header style={{ height: 72, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 3vw", borderBottom: "1px solid rgba(255,255,255,.08)", background: "#050507" }}>
          <Link className="brand" href="/"><span className="brand-main">MAJESTIC</span><span className="brand-plus">+</span></Link>
          <Link href={`/title/${item.slug}`} style={{ color: "#aaa7a0", fontSize: 14 }}>← Wróć do produkcji</Link>
        </header>
        <section style={{ flex: 1, display: "grid", placeItems: "center", padding: "6vw 4vw" }}>
          <div style={{ width: "min(760px, 100%)", textAlign: "center", padding: "48px 34px", border: "1px solid rgba(224,183,95,.2)", borderRadius: 16, background: "radial-gradient(circle at 50% 0%,rgba(224,183,95,.12),transparent 24rem),#090b10", boxShadow: "0 30px 100px rgba(0,0,0,.45)" }}>
            <div style={{ color: "#e2b85f", fontSize: 11, fontWeight: 900, letterSpacing: ".2em" }}>MAJESTIC+ MEMBERSHIP</div>
            <h1 style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: "clamp(42px,7vw,72px)", fontWeight: 500, margin: "14px 0 16px" }}>{viewer ? "Wymagana subskrypcja" : "Zaloguj się, aby oglądać"}</h1>
            <p style={{ maxWidth: 580, margin: "0 auto", color: "#aaa7a0", lineHeight: 1.75, fontSize: 16 }}>
              {viewer ? `„${item.title}” jest dostępne w aktywnym planie Majestic+. Wybierz plan i od razu wróć do oglądania.` : `„${item.title}” wymaga konta Majestic+ oraz aktywnej subskrypcji.`}
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginTop: 28 }}>
              {viewer ? <Link className="primary-btn" href="/subscription">Wybierz plan</Link> : <Link className="primary-btn" href={`/account?next=/watch/${item.slug}`}>Zaloguj się</Link>}
              <Link className="secondary-btn" href={`/title/${item.slug}`}>Więcej informacji</Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  let youtubeId = item.youtubeId ?? null;
  let playingTitle = item.title;
  let playingMeta = `${item.year} · ${item.maturity} · ${item.runtime} · ${item.quality}`;
  let currentEpisodeId: string | null = null;
  let episodes = [] as Awaited<ReturnType<typeof getViewEpisodes>>;

  if (item.contentType === "series") {
    episodes = await getViewEpisodes(item, preview);
    const requested = query.episode ? await getEpisodeById(query.episode, preview) : null;
    const episode = requested && requested.production_id === item.id ? requested : episodes[0] ?? null;
    if (!episode) notFound();
    youtubeId = episode.youtube_id;
    currentEpisodeId = episode.id;
    playingTitle = `${item.title} — ${episode.title}`;
    playingMeta = `S${episode.season_number} E${episode.episode_number} · ${episode.runtime} · ${item.quality}`;
  }

  const embedUrl = youtubeId ? youtubeEmbedUrl(youtubeId) : null;

  return (
    <main style={{minHeight:"100vh",background:"#030304",display:"flex",flexDirection:"column"}}>
      <header style={{height:72,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 3vw",borderBottom:"1px solid rgba(255,255,255,.08)",background:"#050507"}}>
        <Link className="brand" href="/"><span className="brand-main">MAJESTIC</span><span className="brand-plus">+</span></Link>
        <div style={{display:"flex",alignItems:"center",gap:18}}>{!preview && <Link href="/account" style={{color:"#d9b662",fontSize:12,fontWeight:800}}>SUBSKRYPCJA AKTYWNA</Link>}<Link href={`/title/${item.slug}${preview ? "?preview=1" : ""}`} style={{color:"#aaa7a0",fontSize:14}}>← Wróć do produkcji</Link></div>
      </header>

      <section style={{flex:1,display:"grid",placeItems:"center",padding:"4vw"}}>
        <div style={{width:"min(100%, 1380px)"}}>
          {preview && <div style={{marginBottom:12,color:"#deb65f",fontSize:10,fontWeight:900,letterSpacing:".14em"}}>PODGLĄD STUDIO</div>}
          <div style={{aspectRatio:"16/9",border:"1px solid rgba(255,255,255,.08)",background:"#000",position:"relative",overflow:"hidden",boxShadow:"0 30px 100px rgba(0,0,0,.55)"}}>
            {embedUrl ? <iframe src={embedUrl} title={playingTitle} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" style={{width:"100%",height:"100%",border:0,display:"block"}} /> : <div style={{position:"absolute",inset:0,display:"grid",placeItems:"center",textAlign:"center",padding:30,background:item.thumbnailUrl?`linear-gradient(rgba(0,0,0,.72),rgba(0,0,0,.86)),url("${item.thumbnailUrl}") center/cover`:"radial-gradient(circle at 50% 45%, rgba(134,29,45,.25), transparent 30%), linear-gradient(135deg,#111115,#050506)"}}><div><div style={{fontSize:42,marginBottom:14}}>▶</div><strong>Materiał nie został jeszcze podpięty.</strong></div></div>}
          </div>

          <div style={{display:"flex",justifyContent:"space-between",gap:30,alignItems:"flex-start",marginTop:24}}>
            <div><span className="spotlight-kicker">NOW PLAYING</span><h1 style={{fontFamily:'Georgia, "Times New Roman", serif',fontSize:"clamp(34px,4vw,58px)",margin:"8px 0"}}>{playingTitle}</h1><p style={{color:"#aaa7a0",margin:0}}>{playingMeta}</p></div>
            <MyListButton productionId={item.id} />
          </div>

          {item.contentType === "series" && episodes.length > 1 && <div style={{marginTop:34,borderTop:"1px solid rgba(255,255,255,.08)",paddingTop:24}}>
            <span className="spotlight-kicker">NASTĘPNE ODCINKI</span>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:10,marginTop:14}}>
              {episodes.map((episode) => <Link key={episode.id} href={`/watch/${item.slug}?episode=${episode.id}${preview ? "&preview=1" : ""}`} style={{padding:12,borderRadius:8,border:episode.id===currentEpisodeId?"1px solid rgba(220,174,81,.55)":"1px solid rgba(255,255,255,.08)",background:episode.id===currentEpisodeId?"rgba(220,174,81,.08)":"#0a0d12"}}><div style={{aspectRatio:"16/9",borderRadius:6,background:`#111 url("${episode.thumbnail_url ?? ""}") center/cover`,marginBottom:10}}/><span style={{color:"#d9af59",fontSize:9,fontWeight:900}}>S{episode.season_number} E{episode.episode_number}</span><strong style={{display:"block",marginTop:4}}>{episode.title}</strong></Link>)}
            </div>
          </div>}
        </div>
      </section>
    </main>
  );
}
