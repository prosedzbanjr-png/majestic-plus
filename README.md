# Majestic+

Next.js/Vercel application for the Majestic+ public site, Studio, viewer web flows, and streaming control-plane APIs. FiveM Phase 2 extends this existing project; it does not create a second backend or admin panel.

## Reproducible development

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

The committed npm lockfile is authoritative. The Phase 2 baseline uses Next.js 16.3.3, React 19.1.0, TypeScript, ESLint, and Vitest. Next was moved within major version 16 because the prior 16.2.6 tree had high-severity npm audit findings; the current full audit reports zero known vulnerabilities.

## Public FiveM catalog API — version 1

All routes are browse-only `GET` endpoints:

| Route | Bounds | Cache policy |
|---|---|---|
| `/api/v1/fivem/catalog` | 3 editorial rows, at most 12 cards per row | `s-maxage=60`, stale 300 seconds |
| `/api/v1/fivem/catalog/search?q=...&limit=...` | query 1–80 characters, limit 1–24 | `s-maxage=30`, stale 60 seconds |
| `/api/v1/fivem/titles/[slug]` | slug 1–90 characters, at most 120 published episodes | `s-maxage=120`, stale 300 seconds |

Responses use `{ ok: true, data }` or a safe coded error envelope. DTO version `1` exposes only public production metadata and public HTTPS artwork. It deliberately omits YouTube IDs/URLs, viewer identity, subscription state, watch state, payment information, entitlement, and playback capabilities.

The API reuses `majestic_productions`, `majestic_episodes`, and the existing server-side Supabase REST layer in `lib/majestic-db.ts`. Unlike the public website compatibility path in `lib/content.ts`, the FiveM API is strict: missing configuration/database failure returns `CATALOG_UNAVAILABLE`, malformed rows return `CATALOG_INVALID_RESPONSE`, and an empty published catalog remains empty. It never substitutes the static fallback catalog.

See [docs/FIVEM_CATALOG_API.md](docs/FIVEM_CATALOG_API.md) for DTOs, error codes, and operational notes.
