"use client";

import { FormEvent, useState } from "react";
import styles from "./account.module.css";

type Props = {
  configured: boolean;
  linked: boolean;
  maskedPhone: string | null;
  realm: string | null;
  username: string;
};

type Challenge = {
  code: string;
  expiresAt: string;
  username: string;
};

function realmLabel(realm: string | null) {
  if (!realm) return "—";
  if (realm === "lucky-valley") return "Lucky Valley";
  return realm.replace(/[-_.]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function FiveMLinkPanel({ configured, linked, maskedPhone, realm, username }: Props) {
  const [phone, setPhone] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!configured) {
    return (
      <div className={styles.card} style={{ marginTop: 22 }}>
        <span className={styles.eyebrow}>FIVEM</span>
        <h2 style={{ margin: "8px 0 10px", fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 500 }}>Połączenie z FiveM</h2>
        <p style={{ color: "#8f8c86", margin: 0 }}>Integracja FiveM nie jest jeszcze skonfigurowana na serwerze.</p>
      </div>
    );
  }

  async function requestChallenge(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    setChallenge(null);
    try {
      const response = await fetch("/api/account/fivem-link/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error?.message || "Nie udało się wygenerować kodu.");
      setChallenge({ code: data.code, expiresAt: data.expiresAt, username: data.username });
      setMessage("Kod gotowy. Potwierdź go z poziomu Majestic+ na serwerze FiveM.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie udało się wygenerować kodu.");
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/account/fivem-link/unlink", { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error?.message || "Nie udało się rozłączyć FiveM.");
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie udało się rozłączyć FiveM.");
      setBusy(false);
    }
  }

  return (
    <div className={styles.card} style={{ marginTop: 22 }}>
      <span className={styles.eyebrow}>FIVEM</span>
      <h2 style={{ margin: "8px 0 18px", fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 30, fontWeight: 500 }}>
        {linked ? "Połączono" : "Połącz z FiveM"}
      </h2>

      {linked ? (
        <>
          <div style={{ display: "grid", gap: 9, color: "#aaa7a0", fontSize: 13 }}>
            <div>Telefon: <strong style={{ color: "#f4f0e7" }}>{maskedPhone || "***"}</strong></div>
            <div>Serwer: <strong style={{ color: "#f4f0e7" }}>{realmLabel(realm)}</strong></div>
          </div>
          <div className={styles.actions}>
            <button className={styles.ghost} type="button" disabled={busy} onClick={unlink}>
              {busy ? "Rozłączanie…" : "Rozłącz FiveM"}
            </button>
          </div>
        </>
      ) : (
        <form className={styles.form} onSubmit={requestChallenge}>
          <label>
            Numer telefonu w grze
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="555-1234"
              autoComplete="off"
              inputMode="tel"
              maxLength={32}
            />
          </label>
          <button className={styles.gold} type="submit" disabled={busy}>
            {busy ? "Generowanie…" : "Wygeneruj kod połączenia"}
          </button>
        </form>
      )}

      {challenge && (
        <div style={{ marginTop: 16, padding: 16, border: "1px solid rgba(224,183,95,.3)", borderRadius: 8, background: "rgba(224,183,95,.07)" }}>
          <div style={{ color: "#8f8c86", fontSize: 11, letterSpacing: ".12em" }}>KOD PAROWANIA DLA @{challenge.username || username}</div>
          <div style={{ marginTop: 7, color: "#f0c974", fontFamily: "monospace", fontSize: 30, fontWeight: 900, letterSpacing: ".16em" }}>{challenge.code}</div>
          <div style={{ marginTop: 7, color: "#716f6a", fontSize: 11 }}>Ważny mniej więcej do {new Date(challenge.expiresAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}.</div>
        </div>
      )}
      {message && <div className={styles.message} style={{ marginTop: 14 }}>{message}</div>}
      {error && <div className={styles.error} style={{ marginTop: 14 }}>{error}</div>}
    </div>
  );
}
