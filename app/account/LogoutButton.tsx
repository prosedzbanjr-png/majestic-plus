"use client";

import styles from "./account.module.css";

export default function LogoutButton() {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  return <button className={styles.ghost} onClick={logout}>Wyloguj</button>;
}
