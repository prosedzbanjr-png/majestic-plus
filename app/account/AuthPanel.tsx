"use client";

import { FormEvent, useState } from "react";
import styles from "./account.module.css";

export default function AuthPanel({ nextPath = "/" }: { nextPath?: string }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, display_name: displayName }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(data.error ?? "Nie udało się wykonać operacji.");
      setLoading(false);
      return;
    }

    if (data.needsConfirmation) {
      setMessage("Konto utworzone. Sprawdź skrzynkę e-mail i potwierdź adres, a potem się zaloguj.");
      setMode("login");
      setPassword("");
      setLoading(false);
      return;
    }

    window.location.href = nextPath.startsWith("/") ? nextPath : "/";
  }

  return (
    <div className={styles.card}>
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${mode === "login" ? styles.tabActive : ""}`} type="button" onClick={() => { setMode("login"); setError(""); setMessage(""); }}>Logowanie</button>
        <button className={`${styles.tab} ${mode === "signup" ? styles.tabActive : ""}`} type="button" onClick={() => { setMode("signup"); setError(""); setMessage(""); }}>Utwórz konto</button>
      </div>

      <form className={styles.form} onSubmit={submit}>
        {mode === "signup" && (
          <label>Nick
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} maxLength={40} required placeholder="Daichi" autoComplete="nickname" />
          </label>
        )}
        <label>E-mail
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="you@example.com" autoComplete="email" />
        </label>
        <label>Hasło
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required placeholder="Minimum 8 znaków" autoComplete={mode === "login" ? "current-password" : "new-password"} />
        </label>

        {message && <div className={styles.message}>{message}</div>}
        {error && <div className={styles.error}>{error}</div>}

        <button className={styles.gold} disabled={loading} type="submit">
          {loading ? "CHWILA..." : mode === "login" ? "ZALOGUJ SIĘ" : "UTWÓRZ KONTO"}
        </button>
      </form>
    </div>
  );
}
