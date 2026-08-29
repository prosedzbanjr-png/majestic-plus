import Link from "next/link";
import { adminListProductions, isSupabaseConfigured } from "@/lib/majestic-db";
import { isStudioAuthenticated, isStudioPasswordConfigured } from "@/lib/studio-auth";
import LoginForm from "./LoginForm";
import StudioPanel from "./StudioPanel";
import styles from "./studio.module.css";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const passwordReady = isStudioPasswordConfigured();
  const databaseReady = isSupabaseConfigured();

  if (!passwordReady || !databaseReady) {
    return (
      <main className={styles.shell}>
        <header className={styles.header}>
          <Link className={styles.logo} href="/">MAJESTIC<span>+</span></Link>
          <Link className={styles.back} href="/">← Wróć do serwisu</Link>
        </header>
        <section className={styles.setupCard}>
          <span className={styles.kicker}>RICHARDS MAJESTIC STUDIO</span>
          <h1>Panel jest gotowy. Brakuje konfiguracji.</h1>
          <p>Dodaj zmienne środowiskowe do projektu na Vercelu i uruchom plik <code>supabase/schema.sql</code> w SQL Editorze Supabase.</p>
          <div className={styles.envGrid}>
            <code>SUPABASE_URL</code>
            <code>SUPABASE_SERVICE_ROLE_KEY</code>
            <code>STUDIO_PASSWORD</code>
          </div>
          <p className={styles.muted}>Po zapisaniu zmiennych zrób Redeploy. Panel nie pozwala na zapis, dopóki konfiguracja nie jest kompletna.</p>
        </section>
      </main>
    );
  }

  if (!(await isStudioAuthenticated())) {
    return <LoginForm />;
  }

  let productions = [];
  try {
    productions = await adminListProductions();
  } catch {
    productions = [];
  }

  return <StudioPanel initialProductions={productions} />;
}
