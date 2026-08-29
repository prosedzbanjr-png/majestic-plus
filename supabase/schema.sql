create extension if not exists pgcrypto;

create table if not exists public.majestic_productions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  genre text not null default 'Film',
  year integer not null default 2026 check (year between 1900 and 2100),
  maturity text not null default '16+',
  runtime text not null default '—',
  quality text not null default '4K',
  cast jsonb not null default '[]'::jsonb,
  director text not null default 'Richards Majestic Studios',
  original boolean not null default false,
  featured boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published')),
  youtube_url text not null,
  youtube_id text not null,
  thumbnail_url text,
  backdrop_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists majestic_productions_status_idx
  on public.majestic_productions (status);

create index if not exists majestic_productions_featured_idx
  on public.majestic_productions (featured desc, created_at desc);

alter table public.majestic_productions enable row level security;

-- The app talks to Supabase only from server-side Next.js routes using
-- SUPABASE_SERVICE_ROLE_KEY. No public RLS policies are intentionally created.
