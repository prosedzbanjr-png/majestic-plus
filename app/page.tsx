"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

type Preset = { name: string; fontSize: number; lineHeight: number; maxChars: number; background: boolean; contrast: boolean; font: string };
type HistoryItem = { id: string; date: string; text: string };

const DEFAULT_LOG = "> John Doe says: Hey, how's it going?\n> Jane Smith says: *waves* I'm good, thanks.\n> John Doe says: ÷meet me by the pier÷\n[INFO] You have received $500.";
const FONTS = ["Arial", "Inter", "Trebuchet MS", "Verdana", "Georgia", "Courier New"];

function cleanLog(value: string) {
  return value.replace(/~[a-z]~/gi, "").replace(/<[^>]*>/g, "").replace(/\r/g, "").replace(/\u0000/g, "");
}
function getSpeaker(line: string) {
  const match = line.match(/^>\s*(.+?)\s+(?:says|mówi|sagt|dit|dice|говорит):/i);
  return match?.[1]?.trim() ?? "";
}
function lineColor(line: string) {
  const hex = line.match(/!\{#?([0-9a-f]{6})\}/i);
  if (hex) return "#" + hex[1];
  if (/^\s*\[INFO\]/i.test(line)) return "#60a5fa";
  if (/^\s*\[ERROR\]/i.test(line)) return "#f87171";
  if (/^\s*\[POLICE DC\]/i.test(line)) return "#fbbf24";
  if (/^\s*\[RADAR\]/i.test(line)) return "#fb923c";
  if (/^\s*>/.test(line)) return "#e8e8e8";
  return "#b8b8b8";
}
function formatLine(line: string, myName: string, namesOn: boolean, italicOn: boolean) {
  const safeLine = line.replace(/!\{#?([0-9a-f]{6})\}/gi, "");
  const speaker = getSpeaker(line);
  const isMine = Boolean(myName.trim()) && (speaker.toLocaleLowerCase() === myName.trim().toLocaleLowerCase());
  const base = lineColor(line);
  const tokens = safeLine.split(/(\*[^*]+\*|\/[^/\n]+\/|÷[^÷]*÷)/g);
  return tokens.map((token, index) => {
    if (token.startsWith("÷") && token.endsWith("÷")) return <span key={index} className="censored">{token.slice(1, -1)}</span>;
    if (italicOn && token.startsWith("*") && token.endsWith("*")) return <em key={index} className="emote">{token.slice(1, -1)}</em>;
    if (italicOn && token.startsWith("/") && token.endsWith("/") && token.length > 2) return <em key={index}>{token.slice(1, -1)}</em>;
    return <span key={index} style={{ color: isMine ? "#f4c95d" : namesOn ? base : "#e8e8e8" }}>{token}</span>;
  });
}

export default function Home() {
  const [log, setLog] = useState(DEFAULT_LOG);
  const [myName, setMyName] = useState("");
  const [fontSize, setFontSize] = useState(15);
  const [lineHeight, setLineHeight] = useState(1.45);
  const [maxChars, setMaxChars] = useState(120);
  const [font, setFont] = useState("Arial");
  const [background, setBackground] = useState(false);
  const [namesOn, setNamesOn] = useState(true);
  const [italicOn, setItalicOn] = useState(true);
  const [contrast, setContrast] = useState(false);
  const [opsec, setOpsec] = useState(false);
  const [hideSystem, setHideSystem] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("editor");
  const [filterOpen, setFilterOpen] = useState(false);
  const [hideOoc, setHideOoc] = useState(false);
  const [hideRadio, setHideRadio] = useState(false);
  const [hideAds, setHideAds] = useState(false);
  const [hidePhone, setHidePhone] = useState(false);
  const [hideMoney, setHideMoney] = useState(false);
  const [hideSpeakers, setHideSpeakers] = useState<string[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [backgroundUrl, setBackgroundUrl] = useState("");
  const [status, setStatus] = useState("");
  const [canvasSize, setCanvasSize] = useState("1080");
  const outputRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const p = localStorage.getItem("cm-pl-presets");
      const h = localStorage.getItem("cm-pl-history");
      if (p) setPresets(JSON.parse(p));
      if (h) setHistory(JSON.parse(h));
    } catch { /* ignore invalid local browser data */ }
  }, []);

  const sourceLines = useMemo(() => cleanLog(log).split("\n"), [log]);
  const speakers = useMemo(() => Array.from(new Set(sourceLines.map(getSpeaker).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [sourceLines]);
  const lines = useMemo(() => sourceLines.filter((line) => {
    if (hideSystem && /^\s*(\[INFO\]|\[ERROR\]|\[SYSTEM\]|INFO:|ERROR:)/i.test(line)) return false;
    if (hideOoc && /\b(OOC|PM|((to|from)\s+.*\(PM\)))\b/i.test(line)) return false;
    if (hideRadio && /\b(radio|department|dispatch|[A-Z]{2,5}\s*-\s*[A-Z]{2,5})\b/i.test(line)) return false;
    if (hideAds && /^\s*\[(AD|ADVERTISEMENT|REKLAMA)\]/i.test(line)) return false;
    if (hidePhone && /^\s*\[(PHONE|SMS|CALL|TELEFON)\]/i.test(line)) return false;
    if (hideMoney && /\b(received|paid|transferred|salary|bank|cash|otrzymał|wypłacił)\b.*\$[\d,]+/i.test(line)) return false;
    if (hideSpeakers.some((speaker) => getSpeaker(line) === speaker)) return false;
    if (query && !line.toLocaleLowerCase().includes(query.toLocaleLowerCase())) return false;
    return true;
  }), [sourceLines, hideSystem, hideOoc, hideRadio, hideAds, hidePhone, hideMoney, hideSpeakers, query]);
  const displayLines = useMemo(() => lines.map((line) => {
    if (!opsec) return line;
    return line.replace(/(>\s*)(.+?)(\s+(?:says|mówi|sagt|dit|dice|говорит):)/i, "$1[UKRYTO]$3").replace(/\b(?:\+?\d[\d ()-]{7,}\d)\b/g, "[NUMER UKRYTY]");
  }), [lines, opsec]);

  function saveHistory(nextText = log) {
    const item = { id: String(Date.now()), date: new Date().toLocaleString("pl-PL"), text: nextText };
    const next = [item, ...history].slice(0, 20);
    setHistory(next);
    localStorage.setItem("cm-pl-history", JSON.stringify(next));
    setStatus("Zapisano w historii");
  }
  function applyPreset(preset: Preset) {
    setFontSize(preset.fontSize); setLineHeight(preset.lineHeight); setMaxChars(preset.maxChars);
    setBackground(preset.background); setContrast(preset.contrast); setFont(preset.font);
    setStatus("Zastosowano preset: " + preset.name);
  }
  function savePreset() {
    const name = presetName.trim();
    if (!name) { setStatus("Wpisz nazwę presetu"); return; }
    const next = [{ name, fontSize, lineHeight, maxChars, background, contrast, font }, ...presets.filter((item) => item.name !== name)].slice(0, 30);
    setPresets(next); localStorage.setItem("cm-pl-presets", JSON.stringify(next)); setPresetName(""); setStatus("Preset zapisany lokalnie");
  }
  function loadTextFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setLog(cleanLog(String(reader.result ?? ""))); setStatus("Wczytano plik " + file.name); };
    reader.readAsText(file);
    event.target.value = "";
  }
  function loadBackground(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (backgroundUrl) URL.revokeObjectURL(backgroundUrl);
    setBackgroundUrl(URL.createObjectURL(file)); setStatus("Dodano obraz tła");
    event.target.value = "";
  }
  async function copyText() {
    try { await navigator.clipboard.writeText(displayLines.join("\n")); setStatus("Tekst skopiowany"); }
    catch { setStatus("Przeglądarka zablokowała kopiowanie"); }
  }
  async function downloadPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scale = 2;
    const width = Number(canvasSize) || 1080;
    const pad = 36;
    const fontPx = fontSize * scale;
    const linePx = fontPx * lineHeight;
    const wrapLimit = Math.max(20, Math.floor(maxChars));
    const wrapped = displayLines.flatMap((line) => {
      if (!line) return [""];
      const chunks: string[] = [];
      for (let i = 0; i < line.length; i += wrapLimit) chunks.push(line.slice(i, i + wrapLimit));
      return chunks;
    });

    let photo: HTMLImageElement | null = null;
    if (backgroundUrl) {
      try {
        photo = await new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error("Nie udało się wczytać zdjęcia"));
          image.src = backgroundUrl;
        });
      } catch {
        setStatus("Nie udało się wczytać zdjęcia. Wczytaj je ponownie.");
        return;
      }
    }

    const textHeight = Math.max(180, wrapped.length * linePx + pad * 2);
    const photoHeight = photo ? width * (photo.naturalHeight / photo.naturalWidth) : 0;
    const height = Math.max(textHeight, photoHeight || 0);
    canvas.width = width * scale;
    canvas.height = Math.ceil(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(scale, scale);

    if (photo) {
      const ratio = Math.max(width / photo.naturalWidth, height / photo.naturalHeight);
      const drawWidth = photo.naturalWidth * ratio;
      const drawHeight = photo.naturalHeight * ratio;
      ctx.drawImage(photo, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
      if (background) {
        ctx.fillStyle = "rgba(0,0,0,.42)";
        ctx.fillRect(0, 0, width, height);
      }
    } else if (background) {
      ctx.fillStyle = "rgba(0,0,0,.72)";
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.clearRect(0, 0, width, height);
    }

    ctx.font = fontPx + "px " + font;
    ctx.textBaseline = "top";
    let y = pad;
    for (const line of wrapped) {
      const color = lineColor(line);
      if (contrast) {
        ctx.fillStyle = "rgba(0,0,0,.72)";
        ctx.fillRect(pad - 6, y - 2, width - pad * 2 + 12, linePx);
      }
      const speaker = getSpeaker(line);
      const isMine = Boolean(myName.trim()) && speaker.toLocaleLowerCase() === myName.trim().toLocaleLowerCase();
      ctx.fillStyle = opsec ? "#e8e8e8" : isMine ? "#f4c95d" : namesOn ? color : "#e8e8e8";
      ctx.shadowColor = contrast ? "#000" : "transparent";
      ctx.shadowBlur = contrast ? 3 : 0;
      const text = line.replace(/!\{#?[0-9a-f]{6}\}/gi, "").replace(/÷([^÷]*)÷/g, "••••••");
      ctx.fillText(text, pad, y, width - pad * 2);
      y += linePx;
    }

    canvas.toBlob((blob) => {
      if (!blob) { setStatus("Nie udało się utworzyć obrazu"); return; }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "chatlog-magician-pl.png";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus("Pobrano PNG");
    }, "image/png");
  }

  return (
    <main className="cm-app">
      <header className="cm-topbar">
        <a className="cm-brand" href="#" aria-label="Chatlog Magician"><span className="cm-brand-icon">✳</span><span>CHATLOG <b>MAGICIAN</b></span><small>PL</small></a>
        <nav className="cm-nav" aria-label="Nawigacja">
          <button className={tab === "editor" ? "active" : ""} onClick={() => setTab("editor")}>Edytor</button>
          <button className={tab === "presets" ? "active" : ""} onClick={() => setTab("presets")}>Presety</button>
          <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>Historia</button>
          <button className={tab === "help" ? "active" : ""} onClick={() => setTab("help")}>Pomoc</button>
        </nav>
        <div className="cm-top-actions"><span className="cm-status-dot" /> <span className="cm-version">v2.1.2 · PL</span><button className="cm-quiet" onClick={() => { setLog(""); setStatus("Nowy projekt"); }}>Nowy projekt</button></div>
      </header>

      <section className="cm-heading">
        <div><div className="cm-eyebrow"><span /> NARZĘDZIE DLA GTA ROLEPLAY</div><h1>Chatlog <em>Magician</em></h1><p>Przekształć logi czatu w czytelne obrazy. Wklej tekst, dopasuj wygląd i eksportuj gotowy materiał.</p></div>
        <div className="cm-heading-mark" aria-hidden="true"><span>✳</span><i>CM</i></div>
      </section>

      {tab === "editor" && <div className="cm-workspace">
        <aside className="cm-sidebar">
          <section className="cm-panel">
            <div className="cm-panel-title"><span className="cm-step">01</span><div><h2>Źródło czatu</h2><p>Wklej lub wczytaj plik z logiem</p></div></div>
            <textarea className="cm-input cm-log-input" value={log} onChange={(e) => setLog(cleanLog(e.target.value))} spellCheck={false} aria-label="Log czatu" placeholder="Wklej tutaj log czatu..." />
            <div className="cm-button-row"><label className="cm-button cm-button-secondary">Wczytaj TXT<input type="file" accept=".txt,.log,text/plain" onChange={loadTextFile} hidden /></label><button className="cm-button cm-button-secondary" onClick={() => saveHistory()}>Zapisz wersję</button></div>
            <div className="cm-field"><label htmlFor="my-name">Wyróżnij postać</label><input id="my-name" className="cm-input" value={myName} onChange={(e) => setMyName(e.target.value)} placeholder="Wpisz nazwę postaci" /></div>
            <div className="cm-field"><label htmlFor="search-log">Szukaj w logu</label><input id="search-log" className="cm-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Fraza lub nazwa..." /></div>
            <div className="cm-statline"><span>{displayLines.length} widocznych linii</span><span>{sourceLines.length} łącznie</span></div>
          </section>

          <section className="cm-panel">
            <div className="cm-panel-title"><span className="cm-step">02</span><div><h2>Wygląd tekstu</h2><p>Dopasuj typografię i czytelność</p></div></div>
            <div className="cm-field"><div className="cm-range-label"><label htmlFor="font-size">Rozmiar czcionki</label><b>{fontSize}px</b></div><input id="font-size" type="range" min="8" max="32" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} /></div>
            <div className="cm-field"><div className="cm-range-label"><label htmlFor="line-height">Odstęp między liniami</label><b>{lineHeight.toFixed(2)}</b></div><input id="line-height" type="range" min="1" max="2.2" step=".05" value={lineHeight} onChange={(e) => setLineHeight(Number(e.target.value))} /></div>
            <div className="cm-field"><div className="cm-range-label"><label htmlFor="line-width">Długość wiersza</label><b>{maxChars} znaków</b></div><input id="line-width" type="range" min="40" max="220" step="10" value={maxChars} onChange={(e) => setMaxChars(Number(e.target.value))} /></div>
            <div className="cm-field"><label htmlFor="font-family">Krój pisma</label><select id="font-family" className="cm-input" value={font} onChange={(e) => setFont(e.target.value)}>{FONTS.map((item) => <option key={item}>{item}</option>)}</select></div>
            <div className="cm-toggle-list">
              <label><span><b>Tło pod tekstem</b><small>Przyciemnia obszar czatu</small></span><input type="checkbox" checked={background} onChange={(e) => setBackground(e.target.checked)} /></label>
              <label><span><b>Kolory nazw</b><small>Zachowaj kolory logu</small></span><input type="checkbox" checked={namesOn} onChange={(e) => setNamesOn(e.target.checked)} /></label>
              <label><span><b>Emoty i kursywa</b><small>Formatuj *emoty* i /tekst/</small></span><input type="checkbox" checked={italicOn} onChange={(e) => setItalicOn(e.target.checked)} /></label>
              <label><span><b>Kontrast</b><small>Cień poprawiający czytelność</small></span><input type="checkbox" checked={contrast} onChange={(e) => setContrast(e.target.checked)} /></label>
            </div>
          </section>

          <section className="cm-panel">
            <div className="cm-panel-title"><span className="cm-step">03</span><div><h2>Filtry i prywatność</h2><p>Ukryj zbędne dane i linie</p></div></div>
            <div className="cm-toggle-list">
              <label><span><b>Tryb prywatności</b><small>Ukryj nazwy postaci i numery</small></span><input type="checkbox" checked={opsec} onChange={(e) => setOpsec(e.target.checked)} /></label>
              <label><span><b>Komunikaty systemowe</b><small>Ukryj INFO, ERROR i system</small></span><input type="checkbox" checked={hideSystem} onChange={(e) => setHideSystem(e.target.checked)} /></label>
            </div>
            <button className="cm-button cm-button-secondary cm-full" onClick={() => setFilterOpen(!filterOpen)}>{filterOpen ? "Ukryj filtry szczegółowe" : "Otwórz filtry szczegółowe"} <span>{filterOpen ? "−" : "+"}</span></button>
            {filterOpen && <div className="cm-filter-options">
              <label><input type="checkbox" checked={hideOoc} onChange={(e) => setHideOoc(e.target.checked)} /> OOC / prywatne wiadomości</label>
              <label><input type="checkbox" checked={hideRadio} onChange={(e) => setHideRadio(e.target.checked)} /> Radio / departament</label>
              <label><input type="checkbox" checked={hideAds} onChange={(e) => setHideAds(e.target.checked)} /> Reklamy</label>
              <label><input type="checkbox" checked={hidePhone} onChange={(e) => setHidePhone(e.target.checked)} /> Telefon / SMS</label>
              <label><input type="checkbox" checked={hideMoney} onChange={(e) => setHideMoney(e.target.checked)} /> Pieniądze / transakcje</label>
              {speakers.length > 0 && <div className="cm-speakers"><b>Ukryj wypowiedzi postaci</b>{speakers.map((speaker) => <label key={speaker}><input type="checkbox" checked={hideSpeakers.includes(speaker)} onChange={(e) => setHideSpeakers(e.target.checked ? [...hideSpeakers, speaker] : hideSpeakers.filter((name) => name !== speaker))} /> {speaker}</label>)}</div>}
              <button className="cm-text-button" onClick={() => { setHideOoc(false); setHideRadio(false); setHideAds(false); setHidePhone(false); setHideMoney(false); setHideSpeakers([]); setHideSystem(false); }}>Wyczyść filtry</button>
            </div>}
          </section>

          <section className="cm-panel">
            <div className="cm-panel-title"><span className="cm-step">04</span><div><h2>Eksport</h2><p>Przygotuj gotowy obraz</p></div></div>
            <div className="cm-field"><label htmlFor="canvas-size">Szerokość obrazu</label><select className="cm-input" id="canvas-size" value={canvasSize} onChange={(e) => setCanvasSize(e.target.value)}><option value="720">720 px · kompaktowy</option><option value="1080">1080 px · standard</option><option value="1440">1440 px · wysoka jakość</option><option value="1920">1920 px · szeroki</option></select></div>
            <div className="cm-button-row"><button className="cm-button cm-button-primary" onClick={downloadPng}>↓ Pobierz PNG</button><button className="cm-button cm-button-secondary" onClick={copyText}>Kopiuj tekst</button></div>
            <label className="cm-button cm-button-secondary cm-full">↑ Wgraj zdjęcie z komputera<input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/bmp,image/gif" onChange={loadBackground} hidden /></label>
            <p className="cm-upload-note">PNG, JPG, WEBP lub BMP. Zdjęcie zostaje w Twojej przeglądarce i będzie widoczne także w pobranym PNG.</p>
            {backgroundUrl && <button className="cm-text-button" onClick={() => { URL.revokeObjectURL(backgroundUrl); setBackgroundUrl(""); setStatus("Usunięto zdjęcie"); }}>Usuń zdjęcie</button>}
          </section>
        </aside>

        <section className="cm-preview-area">
          <div className="cm-preview-top"><div><span className="cm-live-dot" /> PODGLĄD NA ŻYWO <span className="cm-preview-sep">/</span> <span>{displayLines.length} LINII</span></div><div className="cm-preview-actions"><button onClick={() => setNamesOn(!namesOn)}>{namesOn ? "Kolory: włączone" : "Kolory: wyłączone"}</button><button onClick={() => saveHistory()}>Zapisz</button></div></div>
          <div className="cm-preview-shell">
            <div className="cm-preview-grid" />
            <div className="cm-preview-caption"><span>CHATLOG OUTPUT</span><span>LIVE RENDER</span></div>
            <div ref={outputRef} className={"cm-chat-output" + (background ? " has-background" : "") + (contrast ? " has-contrast" : "")} style={{ fontFamily: font, fontSize: fontSize, lineHeight, backgroundImage: backgroundUrl ? "linear-gradient(rgba(0,0,0,.42),rgba(0,0,0,.42)),url(" + backgroundUrl + ")" : undefined }}>
              {displayLines.length ? displayLines.map((line, index) => <div className="cm-chat-line" key={index} style={{ maxWidth: "100%", overflowWrap: "anywhere" }}>{formatLine(line, myName, namesOn, italicOn)}</div>) : <div className="cm-empty-output"><span>✳</span><b>Twój podgląd pojawi się tutaj</b><small>Wklej log czatu, aby rozpocząć</small></div>}
            </div>
            <div className="cm-preview-footer"><span><i /> GOTOWE DO EKSPORTU</span><span>{canvasSize} PX · PNG</span></div>
          </div>
          <div className="cm-preview-hint"><span>i</span><p>Wskazówka: użyj <code>*tekstu*</code>, aby wyróżnić emoty, oraz <code>÷tekstu÷</code>, aby zasłonić fragment logu. Zmiany widać od razu w podglądzie.</p></div>
          <div className="cm-bottom-stats"><div><span>01</span><b>Podgląd na żywo</b><small>Każda zmiana aktualizuje wynik</small></div><div><span>02</span><b>Przetwarzanie lokalne</b><small>Log pozostaje w tej przeglądarce</small></div><div><span>03</span><b>Eksport PNG</b><small>Obraz gotowy do publikacji</small></div></div>
        </section>
      </div>}

      {tab === "presets" && <section className="cm-secondary-view"><div className="cm-view-heading"><span className="cm-eyebrow">PERSONALIZACJA</span><h2>Twoje presety</h2><p>Zapisz ustawienia wyglądu i wracaj do nich przy kolejnych logach.</p></div><div className="cm-save-preset"><div className="cm-field"><label htmlFor="preset-name">Nazwa presetu</label><input className="cm-input" id="preset-name" value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="np. Ciemny log RP" /></div><button className="cm-button cm-button-primary" onClick={savePreset}>Zapisz bieżące ustawienia</button></div><div className="cm-preset-grid">{presets.length ? presets.map((preset) => <article className="cm-preset-card" key={preset.name}><span className="cm-preset-icon">✳</span><h3>{preset.name}</h3><p>{preset.font} · {preset.fontSize}px · odstęp {preset.lineHeight}</p><div className="cm-preset-sample">{">"} John Doe says: <b>Przykładowa wiadomość</b></div><button className="cm-button cm-button-primary cm-full" onClick={() => applyPreset(preset)}>Zastosuj preset</button><button className="cm-text-button" onClick={() => { const next = presets.filter((item) => item.name !== preset.name); setPresets(next); localStorage.setItem("cm-pl-presets", JSON.stringify(next)); }}>Usuń</button></article>) : <div className="cm-empty-card"><span>✳</span><h3>Nie masz jeszcze presetów</h3><p>W edytorze dopasuj wygląd, a następnie zapisz ustawienia tutaj.</p><button className="cm-button cm-button-primary" onClick={() => setTab("editor")}>Przejdź do edytora</button></div>}</div></section>}

      {tab === "history" && <section className="cm-secondary-view"><div className="cm-view-heading"><span className="cm-eyebrow">TWOJE ZAPISY</span><h2>Historia chatlogów</h2><p>Wersje zapisane lokalnie w tej przeglądarce.</p></div><div className="cm-history-list">{history.length ? history.map((item) => <article className="cm-history-item" key={item.id}><div><b>{item.date}</b><small>{item.text.split("\n").length} linii · {item.text.length} znaków</small><p>{item.text.slice(0, 180)}</p></div><button className="cm-button cm-button-secondary" onClick={() => { setLog(item.text); setTab("editor"); setStatus("Przywrócono zapis"); }}>Przywróć</button></article>) : <div className="cm-empty-card"><span>◷</span><h3>Historia jest pusta</h3><p>Zapisz wersję logu w edytorze, aby móc do niej wrócić.</p></div>}<button className="cm-text-button" onClick={() => { setHistory([]); localStorage.removeItem("cm-pl-history"); }}>Wyczyść historię</button></div></section>}

      {tab === "help" && <section className="cm-secondary-view"><div className="cm-view-heading"><span className="cm-eyebrow">KRÓTKI PORADNIK</span><h2>Jak korzystać z Magician?</h2><p>Najważniejsze funkcje i skróty w jednym miejscu.</p></div><div className="cm-help-grid"><article><span>01</span><h3>Wklej log</h3><p>Wklej tekst z czatu GTA RP lub wczytaj plik TXT. Tekst jest przetwarzany lokalnie w przeglądarce.</p></article><article><span>02</span><h3>Wyróżnij postać</h3><p>Wpisz nazwę swojej postaci, aby podświetlić jej wypowiedzi w podglądzie.</p></article><article><span>03</span><h3>Użyj formatowania</h3><p>Fragmenty otoczone gwiazdkami są traktowane jako emoty. Znaki ÷ pozwalają ukryć wrażliwy fragment.</p></article><article><span>04</span><h3>Filtruj i eksportuj</h3><p>Ukryj niepotrzebne kategorie, włącz tryb prywatności i pobierz obraz PNG.</p></article></div><div className="cm-help-note"><b>Ważne</b><p>Tryb prywatności maskuje nazwę mówcy i numery telefonów w podglądzie. Sprawdź wynik przed publikacją, szczególnie gdy log zawiera dane w niestandardowym formacie.</p></div></section>}

      <footer className="cm-footer"><div className="cm-footer-brand"><span>✳</span> CHATLOG MAGICIAN <b>PL</b></div><span>Narzędzie społeczności GTA RP</span><span>Logi przetwarzane lokalnie · © 2026</span></footer>
      <div className={"cm-toast" + (status ? " visible" : "")} role="status">{status}<button onClick={() => setStatus("")} aria-label="Zamknij komunikat">×</button></div>
      <canvas ref={canvasRef} className="cm-hidden-canvas" aria-hidden="true" />
    </main>
  );
}
