"use client";

import { FormEvent, useState } from "react";
import styles from "./account.module.css";

export default function AuthPanel({ nextPath = "/" }: { nextPath?: string }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, display_name: displayName }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(data.error ?? "Nie udało się wykonać operacji.");
      setLoading(false);
      return;
    }

    window.location.href = nextPath.startsWith("/") ? nextPath : "/";
  }

  return (
    <div className={styles.card}>
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${mode === "login" ? styles.tabActive : ""}`} type="button" onClick={() => { setMode("login"); setError(""); }}>Logowanie</button>
        <button className={`${styles.tab} ${mode === "signup" ? styles.tabActive : ""}`} type="button" onClick={() => { setMode("signup"); setError(""); }}>Utwórz konto</button>
      </div>

      <form className={styles.form} onSubmit={submit}>
        {mode === "signup" && (
          <label>Nick wyświetlany
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} maxLength={40} required placeholder="Daichi Kuroda" autoComplete="nickname" />
          </label>
        )}
        <label>Login
          <input value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} maxLength={24} required placeholder="daichi" autoComplete="username" />
        </label>
        <label>Hasło
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required placeholder="Minimum 8 znaków" autoComplete={mode === "login" ? "current-password" : "new-password"} />
        </label>

        {error && <div className={styles.error}>{error}</div>}

        <button className={styles.gold} disabled={loading} type="submit">
          {loading ? "CHWILA..." : mode === "login" ? "ZALOGUJ SIĘ" : "UTWÓRZ KONTO"}
        </button>
      </form>
    </div>
  );
}
