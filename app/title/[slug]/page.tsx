import Link from "next/link";
import { notFound } from "next/navigation";
import { getViewEpisodes, getViewTitle } from "@/lib/content";
import { titles } from "@/lib/catalog";
import { isStudioAuthenticated } from "@/lib/studio-auth";

export function generateStaticParams() { return titles.map((item) => ({ slug: item.slug })); }
export const dynamicParams = true;
export const dynamic = "force-dynamic";

export default async function TitlePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const preview = query.preview === "1" && (await isStudioAuthenticated());
  const item = await getViewTitle(slug, preview);
  if (!item) notFound();

  const episodes = await getViewEpisodes(item, preview);
  const backgroundImage = item.backdropUrl || item.thumbnailUrl;
  const matchLabel = item.match.endsWith("%") ? `${item.match} match` : item.match;
  const firstEpisode = episodes[0];
  const watchHref = item.contentType === "series"
    ? firstEpisode ? `/watch/${item.slug}?episode=${firstEpisode.id}${preview ? "&preview=1" : ""}` : null
    : item.youtubeId ? `/watch/${item.slug}${preview ? "?preview=1" : ""}` : null;

  return (
    <main>
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Majestic+ home"><span className="brand-main">MAJESTIC</span><span className="brand-plus">+</span></Link>
        <nav className="navlinks" aria-label="Główna nawigacja"><Link href="/">Strona główna</Link><Link href="/#filmy">Filmy</Link><Link href="/#seriale">Seriale</Link><Link href="/#originals">Originals</Link></nav>
        <div className="nav-actions"><Link className="icon-button" href="/search" aria-label="Szukaj">⌕</Link><button className="profile" aria-label="Profil">RM</button></div>
      </header>

      <section style={{minHeight:"78vh",padding:"150px 6vw 80px",display:"flex",alignItems:"flex-end",position:"relative",overflow:"hidden",background:backgroundImage?`linear-gradient(90deg,rgba(4,5,8,.96) 0%,rgba(4,5,8,.68) 42%,rgba(4,5,8,.24) 70%),linear-gradient(180deg,rgba(4,5,8,.08),#070709 100%),url("${backgroundImage}") center/cover no-repeat`:"radial-gradient(circle at 75% 30%, rgba(181,143,77,.28), transparent 12%), radial-gradient(circle at 78% 46%, rgba(124,23,38,.42), transparent 25%), linear-gradient(110deg,#060608 10%,#0d0b0e 52%,#21131a 100%)"}}>
        <div style={{maxWidth:760,position:"relative",zIndex:2}}>
          {preview && <div style={{display:"inline-block",marginBottom:14,padding:"6px 9px",border:"1px solid rgba(231,183,83,.45)",color:"#e7bd68",fontSize:10,fontWeight:900,letterSpacing:".14em"}}>PODGLĄD STUDIO</div>}
          {item.original && <div className="eyebrow">A MAJESTIC+ ORIGINAL</div>}
          <h1 style={{margin:0,fontFamily:'Georgia, "Times New Roman", serif',fontSize:"clamp(54px, 8vw, 124px)",lineHeight:.9,letterSpacing:"-.055em",textTransform:"uppercase"}}>{item.title}</h1>
          <div className="hero-meta"><span className="match">{matchLabel}</span><span>{item.year}</span><span className="rating">{item.maturity}</span><span>{item.runtime}</span><span>{item.quality}</span>{item.contentType === "series" && <span>SERIAL</span>}</div>
          <p style={{maxWidth:650,color:"rgba(244,241,234,.82)",lineHeight:1.7,fontSize:17}}>{item.description}</p>
          <div className="hero-buttons">
            {watchHref ? <Link className="primary-btn" href={watchHref}><span>▶</span>{item.contentType === "series" ? "Oglądaj od początku" : "Oglądaj"}</Link> : <button className="primary-btn" disabled style={{opacity:.5}}><span>▶</span> Brak odcinków</button>}
            <button className="secondary-btn"><span>＋</span> Moja lista</button>
          </div>
        </div>
      </section>

      <section className="content-row" style={{paddingTop:36,paddingBottom:item.contentType === "series" ? 30 : 70}}>
        <div style={{display:"grid",gridTemplateColumns:"minmax(0, 1.5fr) minmax(260px, .7fr)",gap:50,maxWidth:1200}}>
          <div><span className="spotlight-kicker">O PRODUKCJI</span><h2 style={{fontFamily:'Georgia, "Times New Roman", serif',fontSize:36,fontWeight:500,margin:"12px 0 16px"}}>{item.genre}</h2><p style={{color:"#aaa7a0",lineHeight:1.8,margin:0}}>{item.description}</p></div>
          <div style={{borderLeft:"1px solid rgba(255,255,255,.1)",paddingLeft:28}}><p style={{marginTop:0,color:"#aaa7a0"}}><strong style={{color:"#f5f2ea"}}>Obsada</strong><br />{item.cast.length ? item.cast.join(", ") : "—"}</p><p style={{color:"#aaa7a0"}}><strong style={{color:"#f5f2ea"}}>Produkcja</strong><br />{item.director}</p><p style={{color:"#aaa7a0"}}><strong style={{color:"#f5f2ea"}}>Gatunek</strong><br />{item.genre}</p></div>
        </div>
      </section>

      {item.contentType === "series" && <section className="content-row" style={{paddingTop:10,paddingBottom:70}}>
        <span className="spotlight-kicker">ODCINKI</span>
        <h2 style={{fontFamily:'Georgia, "Times New Roman", serif',fontSize:38,fontWeight:500,margin:"10px 0 22px"}}>{episodes.length ? `${episodes.length} odcinków` : "Brak odcinków"}</h2>
        <div style={{display:"grid",gap:12,maxWidth:1200}}>
          {episodes.map((episode) => <Link key={episode.id} href={`/watch/${item.slug}?episode=${episode.id}${preview ? "&preview=1" : ""}`} style={{display:"grid",gridTemplateColumns:"220px 1fr auto",gap:20,alignItems:"center",padding:12,border:"1px solid rgba(255,255,255,.08)",borderRadius:10,background:"#0a0d12"}}>
            <div style={{aspectRatio:"16/9",borderRadius:7,background:`#101319 url("${episode.thumbnail_url ?? ""}") center/cover no-repeat`}} />
            <div><span style={{color:"#dcb25d",fontSize:10,fontWeight:900,letterSpacing:".1em"}}>S{episode.season_number} E{episode.episode_number}{preview && episode.status === "draft" ? " · SZKIC" : ""}</span><h3 style={{margin:"6px 0",fontSize:20}}>{episode.title}</h3><p style={{margin:0,color:"#918e87",lineHeight:1.5,fontSize:13}}>{episode.description || "Bez opisu."}</p></div>
            <span style={{color:"#c9c4ba",fontSize:13}}>{episode.runtime} &nbsp; ▶</span>
          </Link>)}
        </div>
      </section>}

      <footer><div className="footer-brand"><span>MAJESTIC</span><b>+</b></div><p>Streaming by Richards Majestic Studios.</p><small>© 2026 Richards Majestic Studios. All rights reserved.</small></footer>
    </main>
  );
}
