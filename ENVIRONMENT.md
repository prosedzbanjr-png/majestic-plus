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

After adding or changing environment variables on Vercel, redeploy the production deployment.
