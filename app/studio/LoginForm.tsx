"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import styles from "./studio.module.css";

export default function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/studio/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error ?? "Nie udało się zalogować.");
      setLoading(false);
      return;
    }

    window.location.reload();
  }

  return (
    <main className={styles.loginShell}>
      <div className={styles.loginGlow} />
      <Link className={styles.loginLogo} href="/">MAJESTIC<span>+</span></Link>
      <form className={styles.loginCard} onSubmit={submit}>
        <span className={styles.kicker}>RICHARDS MAJESTIC STUDIO</span>
        <h1>Panel produkcji</h1>
        <p>Dodawaj filmy, ustawiaj premiery i podpinaj materiały z YouTube.</p>
        <label>
          Hasło
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoFocus
            autoComplete="current-password"
            placeholder="••••••••"
          />
        </label>
        {error && <div className={styles.error}>{error}</div>}
        <button className={styles.goldButton} disabled={loading} type="submit">
          {loading ? "LOGOWANIE..." : "WEJDŹ DO STUDIO"}
        </button>
      </form>
    </main>
  );
}
