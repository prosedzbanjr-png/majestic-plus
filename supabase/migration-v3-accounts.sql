create table if not exists public.majestic_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.majestic_my_list (
  user_id uuid not null references auth.users(id) on delete cascade,
  production_id uuid not null references public.majestic_productions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, production_id)
);

create index if not exists majestic_my_list_user_idx
  on public.majestic_my_list (user_id, created_at desc);

alter table public.majestic_profiles enable row level security;
alter table public.majestic_my_list enable row level security;

drop policy if exists "majestic_profiles_select_own" on public.majestic_profiles;
create policy "majestic_profiles_select_own"
  on public.majestic_profiles for select
  using (auth.uid() = id);

drop policy if exists "majestic_profiles_update_own" on public.majestic_profiles;
create policy "majestic_profiles_update_own"
  on public.majestic_profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "majestic_my_list_select_own" on public.majestic_my_list;
create policy "majestic_my_list_select_own"
  on public.majestic_my_list for select
  using (auth.uid() = user_id);

drop policy if exists "majestic_my_list_insert_own" on public.majestic_my_list;
create policy "majestic_my_list_insert_own"
  on public.majestic_my_list for insert
  with check (auth.uid() = user_id);

drop policy if exists "majestic_my_list_delete_own" on public.majestic_my_list;
create policy "majestic_my_list_delete_own"
  on public.majestic_my_list for delete
  using (auth.uid() = user_id);

create or replace function public.handle_new_majestic_viewer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.majestic_profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1), 'Viewer')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_majestic on auth.users;
create trigger on_auth_user_created_majestic
  after insert on auth.users
  for each row execute procedure public.handle_new_majestic_viewer();

insert into public.majestic_profiles (id, display_name)
select
  id,
  coalesce(nullif(trim(raw_user_meta_data ->> 'display_name'), ''), split_part(email, '@', 1), 'Viewer')
from auth.users
on conflict (id) do nothing;
