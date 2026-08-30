alter table public.majestic_productions
  add column if not exists content_type text not null default 'film';

alter table public.majestic_productions
  add column if not exists home_section text not null default 'latest';

alter table public.majestic_productions
  add column if not exists display_order integer not null default 0;

alter table public.majestic_productions
  alter column youtube_url drop not null;

alter table public.majestic_productions
  alter column youtube_id drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'majestic_productions_content_type_check'
  ) then
    alter table public.majestic_productions
      add constraint majestic_productions_content_type_check
      check (content_type in ('film', 'series'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'majestic_productions_home_section_check'
  ) then
    alter table public.majestic_productions
      add constraint majestic_productions_home_section_check
      check (home_section in ('popular', 'originals', 'latest'));
  end if;
end $$;

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

create index if not exists majestic_productions_home_idx
  on public.majestic_productions (home_section, display_order, created_at desc);

create index if not exists majestic_episodes_production_idx
  on public.majestic_episodes (production_id, season_number, display_order, episode_number);

alter table public.majestic_episodes enable row level security;
