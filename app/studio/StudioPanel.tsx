"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Episode, Production } from "@/lib/majestic-db";
import styles from "./studio.module.css";

type FormState = {
  title: string;
  slug: string;
  youtube_url: string;
  description: string;
  genre: string;
  year: string;
  maturity: string;
  runtime: string;
  quality: string;
  cast: string;
  director: string;
  thumbnail_url: string;
  backdrop_url: string;
  original: boolean;
  featured: boolean;
  status: "draft" | "published";
  content_type: "film" | "series";
  home_section: "popular" | "originals" | "latest";
  display_order: string;
};

type EpisodeForm = {
  season_number: string;
  episode_number: string;
  title: string;
  description: string;
  runtime: string;
  youtube_url: string;
  thumbnail_url: string;
  status: "draft" | "published";
  display_order: string;
};

const emptyForm: FormState = {
  title: "", slug: "", youtube_url: "", description: "", genre: "Film",
  year: String(new Date().getFullYear()), maturity: "16+", runtime: "", quality: "4K",
  cast: "", director: "Richards Majestic Studios", thumbnail_url: "", backdrop_url: "",
  original: false, featured: false, status: "draft", content_type: "film",
  home_section: "latest", display_order: "0",
};

const emptyEpisode: EpisodeForm = {
  season_number: "1", episode_number: "1", title: "", description: "", runtime: "",
  youtube_url: "", thumbnail_url: "", status: "draft", display_order: "0",
};

function toForm(item: Production): FormState {
  return {
    title: item.title, slug: item.slug, youtube_url: item.youtube_url ?? "", description: item.description,
    genre: item.genre, year: String(item.year), maturity: item.maturity, runtime: item.runtime,
    quality: item.quality, cast: (item.cast_members ?? []).join(", "), director: item.director,
    thumbnail_url: item.thumbnail_url ?? "", backdrop_url: item.backdrop_url ?? "",
    original: item.original, featured: item.featured, status: item.status,
    content_type: item.content_type ?? "film", home_section: item.home_section ?? "latest",
    display_order: String(item.display_order ?? 0),
  };
}

function toEpisodeForm(item: Episode): EpisodeForm {
  return {
    season_number: String(item.season_number), episode_number: String(item.episode_number), title: item.title,
    description: item.description, runtime: item.runtime, youtube_url: item.youtube_url,
    thumbnail_url: item.thumbnail_url ?? "", status: item.status, display_order: String(item.display_order ?? 0),
  };
}

export default function StudioPanel({ initialProductions }: { initialProductions: Production[] }) {
  const [productions, setProductions] = useState(initialProductions);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<"thumbnail" | "backdrop" | "episode" | null>(null);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");

  const series = useMemo(() => productions.filter((item) => item.content_type === "series"), [productions]);
  const [selectedSeriesId, setSelectedSeriesId] = useState(series[0]?.id ?? "");
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [episodeForm, setEpisodeForm] = useState<EpisodeForm>(emptyEpisode);
  const [editingEpisodeId, setEditingEpisodeId] = useState<string | null>(null);
  const [episodeMessage, setEpisodeMessage] = useState("");
  const [episodeLoading, setEpisodeLoading] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return productions;
    return productions.filter((item) => `${item.title} ${item.genre} ${item.status} ${item.content_type}`.toLowerCase().includes(q));
  }, [productions, query]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) { setForm((current) => ({ ...current, [key]: value })); }
  function updateEpisode<K extends keyof EpisodeForm>(key: K, value: EpisodeForm[K]) { setEpisodeForm((current) => ({ ...current, [key]: value })); }

  async function refresh() {
    const response = await fetch("/api/studio/productions", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (response.ok) setProductions(data.productions ?? []);
  }

  async function loadEpisodes(productionId: string) {
    if (!productionId) { setEpisodes([]); return; }
    const response = await fetch(`/api/studio/episodes?production_id=${encodeURIComponent(productionId)}`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (response.ok) setEpisodes(data.episodes ?? []);
  }

  useEffect(() => { if (!selectedSeriesId && series[0]?.id) setSelectedSeriesId(series[0].id); }, [series, selectedSeriesId]);
  useEffect(() => { void loadEpisodes(selectedSeriesId); }, [selectedSeriesId]);

  async function uploadFile(file: File, kind: "thumbnail" | "backdrop" | "episode") {
    setUploading(kind);
    const data = new FormData(); data.append("file", file); data.append("kind", kind);
    const response = await fetch("/api/studio/upload", { method: "POST", body: data });
    const result = await response.json().catch(() => ({}));
    setUploading(null);
    if (!response.ok) throw new Error(result.error ?? "Upload nie powiódł się.");
    return String(result.url);
  }

  async function pickProductionImage(event: React.ChangeEvent<HTMLInputElement>, field: "thumbnail_url" | "backdrop_url") {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      setMessage("");
      const url = await uploadFile(file, field === "thumbnail_url" ? "thumbnail" : "backdrop");
      update(field, url); setMessage("Grafika wysłana.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Upload nie powiódł się."); }
    finally { event.target.value = ""; }
  }

  async function pickEpisodeImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      setEpisodeMessage(""); const url = await uploadFile(file, "episode");
      updateEpisode("thumbnail_url", url); setEpisodeMessage("Miniatura odcinka wysłana.");
    } catch (error) { setEpisodeMessage(error instanceof Error ? error.message : "Upload nie powiódł się."); }
    finally { event.target.value = ""; }
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setMessage("");
    const endpoint = editingId ? `/api/studio/productions/${editingId}` : "/api/studio/productions";
    const response = await fetch(endpoint, { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(data.error ?? "Nie udało się zapisać produkcji."); setLoading(false); return; }
    const created = data.production as Production | undefined;
    setMessage(editingId ? "Zmiany zapisane." : "Produkcja dodana."); setEditingId(null); setForm(emptyForm);
    await refresh(); if (created?.content_type === "series") setSelectedSeriesId(created.id); setLoading(false);
  }

  function edit(item: Production) { setEditingId(item.id); setForm(toForm(item)); setMessage(""); window.scrollTo({ top: 0, behavior: "smooth" }); }

  async function remove(item: Production) {
    if (!window.confirm(`Usunąć „${item.title}”? Tej operacji nie można cofnąć.`)) return;
    const response = await fetch(`/api/studio/productions/${item.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(data.error ?? "Nie udało się usunąć produkcji."); return; }
    if (editingId === item.id) { setEditingId(null); setForm(emptyForm); }
    if (selectedSeriesId === item.id) setSelectedSeriesId(""); await refresh();
  }

  async function submitEpisode(event: FormEvent) {
    event.preventDefault(); if (!selectedSeriesId) return; setEpisodeLoading(true); setEpisodeMessage("");
    const endpoint = editingEpisodeId ? `/api/studio/episodes/${editingEpisodeId}` : "/api/studio/episodes";
    const response = await fetch(endpoint, { method: editingEpisodeId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...episodeForm, production_id: selectedSeriesId }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setEpisodeMessage(data.error ?? "Nie udało się zapisać odcinka."); setEpisodeLoading(false); return; }
    setEpisodeMessage(editingEpisodeId ? "Odcinek zaktualizowany." : "Odcinek dodany."); setEditingEpisodeId(null); setEpisodeForm(emptyEpisode);
    await loadEpisodes(selectedSeriesId); setEpisodeLoading(false);
  }

  function editEpisode(item: Episode) { setEditingEpisodeId(item.id); setEpisodeForm(toEpisodeForm(item)); setEpisodeMessage(""); }
  async function removeEpisode(item: Episode) {
    if (!window.confirm(`Usunąć S${item.season_number}E${item.episode_number} „${item.title}”?`)) return;
    const response = await fetch(`/api/studio/episodes/${item.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setEpisodeMessage(data.error ?? "Nie udało się usunąć odcinka."); return; }
    if (editingEpisodeId === item.id) { setEditingEpisodeId(null); setEpisodeForm(emptyEpisode); } await loadEpisodes(selectedSeriesId);
  }

  async function logout() { await fetch("/api/studio/logout", { method: "POST" }); window.location.reload(); }
  const selectedSeries = series.find((item) => item.id === selectedSeriesId);
  const messageIsError = /nie udało|error|supabase\s+\d|failed|invalid|błąd/i.test(message);
  const episodeMessageIsError = /nie udało|error|supabase\s+\d|failed|invalid|błąd/i.test(episodeMessage);

  return <main className={styles.shell}>
    <header className={styles.header}><div><Link className={styles.logo} href="/">MAJESTIC<span>+</span></Link><span className={styles.studioTag}>STUDIO</span></div><div className={styles.headerActions}><Link className={styles.back} href="/">Otwórz serwis ↗</Link><button className={styles.ghostButton} onClick={logout}>Wyloguj</button></div></header>
    <section className={styles.dashboard}>
      <div className={styles.intro}><span className={styles.kicker}>RICHARDS MAJESTIC CONTENT SYSTEM</span><h1>{editingId ? "Edytuj produkcję" : "Nowa produkcja"}</h1><p>Film lub serial siedzi na YouTube. Majestic+ trzyma katalog, kolejność, grafiki i prezentację.</p></div>

      <form className={styles.formCard} onSubmit={submit}>
        <div className={styles.formGrid}>
          <label>Typ<select value={form.content_type} onChange={(e) => update("content_type", e.target.value as FormState["content_type"])}><option value="film">Film</option><option value="series">Serial</option></select></label>
          <label>Sekcja głównej<select value={form.home_section} onChange={(e) => update("home_section", e.target.value as FormState["home_section"])}><option value="popular">Popularne teraz</option><option value="originals">Majestic+ Originals</option><option value="latest">Ostatnio dodane</option></select></label>
          <label>Kolejność<input type="number" min="0" max="9999" value={form.display_order} onChange={(e) => update("display_order", e.target.value)} /></label>
          <label>Rok<input type="number" min="1900" max="2100" value={form.year} onChange={(e) => update("year", e.target.value)} /></label>
          <label className={styles.span2}>Tytuł<input value={form.title} onChange={(e) => update("title", e.target.value)} required placeholder="Vinewood Nights" /></label>
          <label className={styles.span2}>Slug<input value={form.slug} onChange={(e) => update("slug", e.target.value)} placeholder="automatycznie-z-tytulu" /></label>
          <label className={styles.span2}>Link YouTube {form.content_type === "series" ? "— opcjonalny trailer" : ""}<input value={form.youtube_url} onChange={(e) => update("youtube_url", e.target.value)} required={form.content_type === "film"} placeholder="https://www.youtube.com/watch?v=..." /></label>
          <label>Gatunek<input value={form.genre} onChange={(e) => update("genre", e.target.value)} /></label><label>Czas trwania<input value={form.runtime} onChange={(e) => update("runtime", e.target.value)} /></label><label>Ograniczenie<input value={form.maturity} onChange={(e) => update("maturity", e.target.value)} /></label><label>Jakość<input value={form.quality} onChange={(e) => update("quality", e.target.value)} /></label>
          <label className={styles.span2}>Opis<textarea value={form.description} onChange={(e) => update("description", e.target.value)} rows={4} /></label><label className={styles.span2}>Obsada<input value={form.cast} onChange={(e) => update("cast", e.target.value)} /></label><label className={styles.span2}>Produkcja / reżyser<input value={form.director} onChange={(e) => update("director", e.target.value)} /></label>
          <div className={`${styles.span2} ${styles.uploadField}`}><label>Thumbnail 16:9<input value={form.thumbnail_url} onChange={(e) => update("thumbnail_url", e.target.value)} placeholder="URL albo wyślij plik" /></label><label className={styles.fileButton}>{uploading === "thumbnail" ? "WYSYŁANIE..." : "WYŚLIJ THUMBNAIL"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void pickProductionImage(e, "thumbnail_url")} disabled={Boolean(uploading)} /></label>{form.thumbnail_url && <div className={styles.imagePreview} style={{ backgroundImage: `url("${form.thumbnail_url}")` }} />}</div>
          <div className={`${styles.span2} ${styles.uploadField}`}><label>Backdrop hero<input value={form.backdrop_url} onChange={(e) => update("backdrop_url", e.target.value)} placeholder="URL albo wyślij plik" /></label><label className={styles.fileButton}>{uploading === "backdrop" ? "WYSYŁANIE..." : "WYŚLIJ BACKDROP"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void pickProductionImage(e, "backdrop_url")} disabled={Boolean(uploading)} /></label>{form.backdrop_url && <div className={styles.imagePreview} style={{ backgroundImage: `url("${form.backdrop_url}")` }} />}</div>
        </div>
        <div className={styles.switchRow}><label className={styles.check}><input type="checkbox" checked={form.original} onChange={(e) => update("original", e.target.checked)} /> Majestic+ Original</label><label className={styles.check}><input type="checkbox" checked={form.featured} onChange={(e) => update("featured", e.target.checked)} /> Featured na głównej</label><label className={styles.statusLabel}>Status<select value={form.status} onChange={(e) => update("status", e.target.value as FormState["status"])}><option value="draft">Szkic</option><option value="published">Opublikowane</option></select></label></div>
        {message && <div className={messageIsError ? styles.error : styles.success}>{message}</div>}
        <div className={styles.formActions}><button className={styles.goldButton} disabled={loading || Boolean(uploading)} type="submit">{loading ? "ZAPISYWANIE..." : editingId ? "ZAPISZ ZMIANY" : "DODAJ PRODUKCJĘ"}</button>{editingId && <button className={styles.ghostButton} type="button" onClick={() => { setEditingId(null); setForm(emptyForm); setMessage(""); }}>Anuluj edycję</button>}</div>
      </form>

      <div className={styles.libraryHeader}><div><span className={styles.kicker}>BIBLIOTEKA</span><h2>Produkcje</h2></div><input className={styles.searchInput} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj po tytule..." /></div>
      <div className={styles.productionList}>{filtered.map((item) => <article className={styles.productionCard} key={item.id}><div className={styles.preview} style={{ backgroundImage: `linear-gradient(180deg,transparent,rgba(0,0,0,.76)),url("${item.thumbnail_url ?? ""}")` }}><span>RM</span>{item.original && <b>M+</b>}</div><div className={styles.productionBody}><div className={styles.productionTopline}><span className={item.status === "published" ? styles.published : styles.draft}>{item.status === "published" ? "OPUBLIKOWANE" : "SZKIC"}</span>{item.featured && <span className={styles.featured}>FEATURED</span>}<span className={styles.typeBadge}>{item.content_type === "series" ? "SERIAL" : "FILM"}</span></div><h3>{item.title}</h3><p>{item.genre} · {item.year} · {item.runtime}</p><small>{item.home_section} · kolejność {item.display_order ?? 0}</small></div><div className={styles.cardActions}><Link href={`/title/${item.slug}?preview=1`} target="_blank">Podgląd</Link>{item.content_type === "series" && <button onClick={() => { setSelectedSeriesId(item.id); document.getElementById("episodes")?.scrollIntoView({ behavior: "smooth" }); }}>Odcinki</button>}<button onClick={() => edit(item)}>Edytuj</button><button className={styles.deleteButton} onClick={() => remove(item)}>Usuń</button></div></article>)}{!filtered.length && <div className={styles.empty}>Brak produkcji do wyświetlenia.</div>}</div>

      <section className={styles.episodeSection} id="episodes"><div className={styles.libraryHeader}><div><span className={styles.kicker}>SERIALE</span><h2>Odcinki</h2></div><select className={styles.seriesSelect} value={selectedSeriesId} onChange={(e) => { setSelectedSeriesId(e.target.value); setEditingEpisodeId(null); setEpisodeForm(emptyEpisode); }}><option value="">Wybierz serial</option>{series.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></div>
        {!series.length ? <div className={styles.empty}>Najpierw dodaj produkcję typu Serial.</div> : selectedSeries ? <><form className={styles.formCard} onSubmit={submitEpisode}><div className={styles.episodeHeading}><strong>{selectedSeries.title}</strong><span>{editingEpisodeId ? "EDYCJA ODCINKA" : "NOWY ODCINEK"}</span></div><div className={styles.formGrid}><label>Sezon<input type="number" min="1" value={episodeForm.season_number} onChange={(e) => updateEpisode("season_number", e.target.value)} /></label><label>Odcinek<input type="number" min="1" value={episodeForm.episode_number} onChange={(e) => updateEpisode("episode_number", e.target.value)} /></label><label>Kolejność<input type="number" min="0" value={episodeForm.display_order} onChange={(e) => updateEpisode("display_order", e.target.value)} /></label><label>Czas<input value={episodeForm.runtime} onChange={(e) => updateEpisode("runtime", e.target.value)} placeholder="24m" /></label><label className={styles.span2}>Tytuł<input value={episodeForm.title} onChange={(e) => updateEpisode("title", e.target.value)} required /></label><label className={styles.span2}>YouTube<input value={episodeForm.youtube_url} onChange={(e) => updateEpisode("youtube_url", e.target.value)} required /></label><label className={styles.span2}>Opis<textarea rows={3} value={episodeForm.description} onChange={(e) => updateEpisode("description", e.target.value)} /></label><div className={`${styles.span2} ${styles.uploadField}`}><label>Miniatura odcinka<input value={episodeForm.thumbnail_url} onChange={(e) => updateEpisode("thumbnail_url", e.target.value)} /></label><label className={styles.fileButton}>{uploading === "episode" ? "WYSYŁANIE..." : "WYŚLIJ MINIATURĘ"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void pickEpisodeImage(e)} disabled={Boolean(uploading)} /></label></div></div><div className={styles.switchRow}><label className={styles.statusLabel}>Status<select value={episodeForm.status} onChange={(e) => updateEpisode("status", e.target.value as EpisodeForm["status"])}><option value="draft">Szkic</option><option value="published">Opublikowane</option></select></label></div>{episodeMessage && <div className={episodeMessageIsError ? styles.error : styles.success}>{episodeMessage}</div>}<div className={styles.formActions}><button className={styles.goldButton} disabled={episodeLoading || Boolean(uploading)} type="submit">{episodeLoading ? "ZAPISYWANIE..." : editingEpisodeId ? "ZAPISZ ODCINEK" : "DODAJ ODCINEK"}</button>{editingEpisodeId && <button className={styles.ghostButton} type="button" onClick={() => { setEditingEpisodeId(null); setEpisodeForm(emptyEpisode); }}>Anuluj</button>}</div></form>
        <div className={styles.episodeList}>{episodes.map((item) => <article className={styles.episodeCard} key={item.id}><div className={styles.episodeThumb} style={{ backgroundImage: `url("${item.thumbnail_url ?? ""}")` }} /><div><span>S{item.season_number}E{item.episode_number}</span><h3>{item.title}</h3><p>{item.runtime} · {item.status === "published" ? "Opublikowany" : "Szkic"}</p></div><div className={styles.cardActions}><Link href={`/watch/${selectedSeries.slug}?episode=${item.id}&preview=1`} target="_blank">Podgląd</Link><button onClick={() => editEpisode(item)}>Edytuj</button><button className={styles.deleteButton} onClick={() => removeEpisode(item)}>Usuń</button></div></article>)}{!episodes.length && <div className={styles.empty}>Ten serial nie ma jeszcze odcinków.</div>}</div></> : null}
      </section>
    </section>
  </main>;
}
