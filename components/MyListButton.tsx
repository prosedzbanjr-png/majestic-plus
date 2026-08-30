"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function MyListButton({ productionId, className = "secondary-btn" }: { productionId?: string; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(Boolean(productionId));
  const [loggedOut, setLoggedOut] = useState(false);

  useEffect(() => {
    if (!productionId) {
      setLoading(false);
      return;
    }

    let active = true;
    fetch(`/api/my-list?productionId=${encodeURIComponent(productionId)}`, { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          if (active) setLoggedOut(true);
          return null;
        }
        return response.json().catch(() => null);
      })
      .then((data) => {
        if (active && data) setSaved(Boolean(data.saved));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [productionId]);

  async function toggle() {
    if (!productionId || loggedOut) {
      router.push(`/account?next=${encodeURIComponent(pathname)}`);
      return;
    }

    setLoading(true);
    const response = await fetch("/api/my-list", {
      method: saved ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productionId }),
    });

    if (response.status === 401) {
      router.push(`/account?next=${encodeURIComponent(pathname)}`);
      return;
    }

    const data = await response.json().catch(() => ({}));
    if (response.ok) setSaved(Boolean(data.saved));
    setLoading(false);
  }

  return (
    <button className={className} type="button" onClick={toggle} disabled={loading}>
      <span>{saved ? "✓" : "＋"}</span>{loading ? " Chwila..." : saved ? " Na mojej liście" : " Moja lista"}
    </button>
  );
}
