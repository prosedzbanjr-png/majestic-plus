# FiveM catalog API v1

The Phase 2 contract is public and read-only. FiveM server Lua calls these routes over HTTPS; the LB-Phone iframe never calls Supabase or these JSON routes directly.

## DTOs

`CatalogCard` contains `id`, `slug`, `title`, `type`, optional `year`/`ageRating`, `genres`, optional public `posterUrl`/`backdropUrl`, and an optional editorial `badge`.

Home returns:

```json
{
  "ok": true,
  "data": {
    "version": "1",
    "featured": { "...": "CatalogFeature" },
    "rows": [{ "key": "popular", "title": "Popularne teraz", "items": [] }]
  }
}
```

Search returns `version`, the normalized bounded query, and up to 24 cards. Details returns card fields plus a bounded description, optional duration in seconds, the editorial featured flag, and—for series only—seasons with published episode number/title/description/duration/artwork metadata.

The implementation selects explicit columns from `majestic_productions` and `majestic_episodes`; raw PostgREST rows and YouTube playback fields are never returned.

## Errors and diagnostics

Stable codes are `CATALOG_UNAVAILABLE`, `CATALOG_INVALID_RESPONSE`, `SEARCH_INVALID`, `TITLE_INVALID`, `TITLE_NOT_FOUND`, and `RATE_LIMITED`. Provider bodies and stack traces are not exposed. Errors include a correlation ID, and every response supplies `X-Correlation-ID`.

The public rate limiter is a bounded, best-effort per-instance abuse guard. CDN/Vercel edge controls should enforce the production distributed limit; no privileged security decision relies on the in-memory limiter. Public cache headers are explicit. Errors are `no-store`.

Maximum serialized response size is 256 KiB. Only HTTPS artwork is admitted to DTOs. The current deployed catalog uses `https://i.ytimg.com`; adding a Supabase Storage artwork origin requires an explicit corresponding FiveM CSP/validator update.

## Non-goals

This namespace has no mutation route, machine secret, viewer identity, subscription, payment, entitlement, watch state, protected media URL, or playback authorization. Those remain later-phase contracts.
