"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import type { Production } from "@/lib/majestic-db";
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
};

const emptyForm: FormState = {
  title: "",
  slug: "",
  youtube_url: "",
  description: "",
  genre: "Film",
  year: String(new Date().getFullYear()),
  maturity: "16+",
  runtime: "",
  quality: "4K",
  cast: "",
  director: "Richards Majestic Studios",
  thumbnail_url: "",
  backdrop_url: "",
  original: false,
  featured: false,
  status: "draft",
};

function toForm(item: Production): FormState {
  return {
    title: item.title,
    slug: item.slug,
    youtube_url: item.youtube_url,
    description: item.description,
    genre: item.genre,
    year: String(item.year),
    maturity: item.maturity,
    runtime: item.runtime,
    quality: item.quality,
    cast: (item.cast ?? []).join(", "),
    director: item.director,
    thumbnail_url: item.thumbnail_url ?? "",
    backdrop_url: item.backdrop_url ?? "",
    original: item.original,
    featured: item.featured,
    status: item.status,
  };
}

export default function StudioPanel({ initialProductions }: { initialProductions: Production[] }) {
  const [productions, setProductions] = useState(initialProductions);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return productions;
    return productions.filter((item) => `${item.title} ${item.genre} ${item.status}`.toLowerCase().includes(q));
  }, [productions, query]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function refresh() {
    const response = await fetch("/api/studio/productions", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (response.ok) setProductions(data.productions ?? []);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const endpoint = editingId ? `/api/studio/productions/${editingId}` : "/api/studio/productions";
    const response = await fetch(endpoint, {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(data.error ?? "Nie udało się zapisać produkcji.");
      setLoading(false);
      return;
    }

    setMessage(editingId ? "Zmiany zapisane." : "Produkcja dodana.");
    setEditingId(null);
    setForm(emptyForm);
    await refresh();
    setLoading(false);
  }

  function edit(item: Production) {
    setEditingId(item.id);
    setForm(toForm(item));
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function remove(item: Production) {
    if (!window.confirm(`Usunąć „${item.title}”? Tej operacji nie można cofnąć.`)) return;
    const response = await fetch(`/api/studio/productions/${item.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error ?? "Nie udało się usunąć produkcji.");
      return;
    }
    if (editingId === item.id) {
      setEditingId(null);
      setForm(emptyForm);
    }
    await refresh();
  }

  async function logout() {
    await fetch("/api/studio/logout", { method: "POST" });
    window.location.reload();
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <Link className={styles.logo} href="/">MAJESTIC<span>+</span></Link>
          <span className={styles.studioTag}>STUDIO</span>
        </div>
        <div className={styles.headerActions}>
          <Link className={styles.back} href="/">Otwórz serwis ↗</Link>
          <button className={styles.ghostButton} onClick={logout}>Wyloguj</button>
        </div>
      </header>

      <section className={styles.dashboard}>
        <div className={styles.intro}>
          <span className={styles.kicker}>RICHARDS MAJESTIC CONTENT SYSTEM</span>
          <h1>{editingId ? "Edytuj produkcję" : "Nowa produkcja"}</h1>
          <p>Film siedzi na YouTube. Majestic+ przechowuje metadane, grafiki i sposób prezentacji.</p>
        </div>

        <form className={styles.formCard} onSubmit={submit}>
          <div className={styles.formGrid}>
            <label className={styles.span2}>Tytuł<input value={form.title} onChange={(e) => update("title", e.target.value)} required placeholder="Vinewood Nights" /></label>
            <label>Slug<input value={form.slug} onChange={(e) => update("slug", e.target.value)} placeholder="automatycznie-z-tytulu" /></label>
            <label>Rok<input type="number" min="1900" max="2100" value={form.year} onChange={(e) => update("year", e.target.value)} /></label>
            <label className={styles.span2}>Link YouTube<input value={form.youtube_url} onChange={(e) => update("youtube_url", e.target.value)} required placeholder="https://www.youtube.com/watch?v=..." /></label>
            <label>Gatunek<input value={form.genre} onChange={(e) => update("genre", e.target.value)} placeholder="Crime / Thriller" /></label>
            <label>Czas trwania<input value={form.runtime} onChange={(e) => update("runtime", e.target.value)} placeholder="2h 07m" /></label>
            <label>Ograniczenie<input value={form.maturity} onChange={(e) => update("maturity", e.target.value)} placeholder="18+" /></label>
            <label>Jakość<input value={form.quality} onChange={(e) => update("quality", e.target.value)} placeholder="4K" /></label>
            <label className={styles.span2}>Opis<textarea value={form.description} onChange={(e) => update("description", e.target.value)} rows={4} placeholder="Krótki opis produkcji..." /></label>
            <label className={styles.span2}>Obsada<input value={form.cast} onChange={(e) => update("cast", e.target.value)} placeholder="Imię Nazwisko, Imię Nazwisko" /></label>
            <label className={styles.span2}>Produkcja / reżyser<input value={form.director} onChange={(e) => update("director", e.target.value)} /></label>
            <label className={styles.span2}>Thumbnail 16:9 — opcjonalnie<input value={form.thumbnail_url} onChange={(e) => update("thumbnail_url", e.target.value)} placeholder="https://...jpg (bez tego użyjemy miniatury YouTube)" /></label>
            <label className={styles.span2}>Backdrop hero — opcjonalnie<input value={form.backdrop_url} onChange={(e) => update("backdrop_url", e.target.value)} placeholder="https://...jpg" /></label>
          </div>

          <div className={styles.switchRow}>
            <label className={styles.check}><input type="checkbox" checked={form.original} onChange={(e) => update("original", e.target.checked)} /> Majestic+ Original</label>
            <label className={styles.check}><input type="checkbox" checked={form.featured} onChange={(e) => update("featured", e.target.checked)} /> Featured na głównej</label>
            <label className={styles.statusLabel}>Status
              <select value={form.status} onChange={(e) => update("status", e.target.value as FormState["status"])}>
                <option value="draft">Szkic</option>
                <option value="published">Opublikowane</option>
              </select>
            </label>
          </div>

          {message && <div className={message.toLowerCase().includes("nie") || message.toLowerCase().includes("error") ? styles.error : styles.success}>{message}</div>}

          <div className={styles.formActions}>
            <button className={styles.goldButton} disabled={loading} type="submit">{loading ? "ZAPISYWANIE..." : editingId ? "ZAPISZ ZMIANY" : "DODAJ PRODUKCJĘ"}</button>
            {editingId && <button className={styles.ghostButton} type="button" onClick={() => { setEditingId(null); setForm(emptyForm); setMessage(""); }}>Anuluj edycję</button>}
          </div>
        </form>

        <div className={styles.libraryHeader}>
          <div><span className={styles.kicker}>BIBLIOTEKA</span><h2>Produkcje</h2></div>
          <input className={styles.searchInput} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj po tytule..." />
        </div>

        <div className={styles.productionList}>
          {filtered.map((item) => (
            <article className={styles.productionCard} key={item.id}>
              <div className={styles.preview} style={{ backgroundImage: `linear-gradient(180deg,transparent,rgba(0,0,0,.76)),url("${item.thumbnail_url ?? ""}")` }}>
                <span>RM</span>
                {item.original && <b>M+</b>}
              </div>
              <div className={styles.productionBody}>
                <div className={styles.productionTopline}><span className={item.status === "published" ? styles.published : styles.draft}>{item.status === "published" ? "OPUBLIKOWANE" : "SZKIC"}</span>{item.featured && <span className={styles.featured}>FEATURED</span>}</div>
                <h3>{item.title}</h3>
                <p>{item.genre} · {item.year} · {item.runtime}</p>
                <small>{item.youtube_id}</small>
              </div>
              <div className={styles.cardActions}>
                <Link href={`/title/${item.slug}`} target="_blank">Podgląd</Link>
                <button onClick={() => edit(item)}>Edytuj</button>
                <button className={styles.deleteButton} onClick={() => remove(item)}>Usuń</button>
              </div>
            </article>
          ))}
          {!filtered.length && <div className={styles.empty}>Brak produkcji do wyświetlenia.</div>}
        </div>
      </section>
    </main>
  );
}
