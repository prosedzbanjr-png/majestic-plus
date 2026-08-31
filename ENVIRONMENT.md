# Majestic+ environment variables

Set these in Vercel Project Settings → Environment Variables.

## Core / Studio

- `SUPABASE_URL` — Supabase project URL, e.g. `https://project-ref.supabase.co`.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only Supabase service/secret key. Never expose it in client code.
- `STUDIO_PASSWORD` — password for `/studio`.

## Viewer accounts

Set one of these public auth keys (the app supports either name):

- `SUPABASE_PUBLISHABLE_KEY` — recommended newer Supabase publishable key (`sb_publishable_...`).
- `SUPABASE_ANON_KEY` — legacy anon key if the project still uses legacy JWT API keys.

Viewer authentication is server-mediated through Next.js route handlers. The public/publishable key is used only for Supabase Auth; the service-role key remains server-only.

## FiveM catalog API

The Phase 2 browse-only catalog routes use the existing server-only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. They intentionally remain public and do not require the machine key.

## FiveM Control Plane V1

The private FiveM control-plane routes require all three values below:

- `MAJESTIC_FIVEM_REALM` — stable realm identifier, for example `lucky-valley`.
- `MAJESTIC_FIVEM_API_KEY` — long random bearer key used only by the trusted `majestic_plus` FiveM server resource and Vercel. Never expose it to NUI/browser JavaScript.
- `MAJESTIC_LINK_SECRET` — separate long random HMAC secret used by Vercel to derive pairing codes and hashed FiveM subjects. Never give this value to FiveM, browsers, Supabase, or logs.

Use different `MAJESTIC_FIVEM_API_KEY` and `MAJESTIC_LINK_SECRET` values in Preview and Production. The Production FiveM server needs only the Production `MAJESTIC_FIVEM_API_KEY`; it does not need `MAJESTIC_LINK_SECRET`.

After adding or changing environment variables on Vercel, redeploy the corresponding Preview or Production deployment.
