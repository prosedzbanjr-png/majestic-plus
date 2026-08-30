import Link from "next/link";

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <nav style={{ position: "fixed", right: 18, bottom: 18, zIndex: 90, display: "flex", gap: 8, padding: 7, border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, background: "rgba(4,6,9,.92)", backdropFilter: "blur(12px)", boxShadow: "0 15px 50px rgba(0,0,0,.35)" }}>
        <Link href="/studio" style={{ padding: "9px 12px", borderRadius: 7, background: "rgba(255,255,255,.06)", color: "#d7d2c7", fontSize: 10, fontWeight: 900, letterSpacing: ".08em" }}>CONTENT</Link>
        <Link href="/studio/billing" style={{ padding: "9px 12px", borderRadius: 7, background: "linear-gradient(135deg,#e4c271,#b78332)", color: "#0c0a07", fontSize: 10, fontWeight: 950, letterSpacing: ".08em" }}>BILLING</Link>
      </nav>
    </>
  );
}
