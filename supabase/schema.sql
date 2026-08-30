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
  cast_members jsonb not null default '[]'::jsonb,
  director text not null default 'Richards Majestic Studios',
  original boolean not null default false,
  featured boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published')),
  content_type text not null default 'film' check (content_type in ('film', 'series')),
  home_section text not null default 'latest' check (home_section in ('popular', 'originals', 'latest')),
  display_order integer not null default 0,
  youtube_url text,
  youtube_id text,
  thumbnail_url text,
  backdrop_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.majestic_episodes (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.majestic_productions(id) on delete cascade,
  season_number integer not null default 1 check (season_number >= 1),
  episode_number integer not null default 1 check (episode_number >= 1),
  title text not null,
  description text not null default '',
  runtime text not null default '—',
  youtube_url text not null,
  youtube_id text not null,
  thumbnail_url text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (production_id, season_number, episode_number)
);

create index if not exists majestic_productions_status_idx on public.majestic_productions (status);
create index if not exists majestic_productions_home_idx on public.majestic_productions (home_section, display_order, created_at desc);
create index if not exists majestic_productions_featured_idx on public.majestic_productions (featured desc, display_order asc);
create index if not exists majestic_episodes_production_idx on public.majestic_episodes (production_id, season_number, display_order, episode_number);

alter table public.majestic_productions enable row level security;
alter table public.majestic_episodes enable row level security;

-- The app talks to Supabase only from server-side Next.js routes using
-- SUPABASE_SERVICE_ROLE_KEY. No public RLS policies are intentionally created.
