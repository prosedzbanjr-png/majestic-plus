create table if not exists public.majestic_subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  price integer not null check (price >= 0),
  currency text not null default 'USD',
  billing_days integer not null default 30 check (billing_days > 0),
  max_devices integer not null default 1 check (max_devices > 0),
  quality text not null default 'HD',
  features jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.majestic_subscription_plans
  (code, name, price, currency, billing_days, max_devices, quality, features, active, display_order)
values
  ('essential', 'Essential', 49, 'USD', 30, 1, 'HD', '["Cały katalog Majestic+", "Jeden profil oglądający", "Jakość HD"]'::jsonb, true, 10),
  ('cinema', 'Cinema', 99, 'USD', 30, 2, 'Full HD', '["Cały katalog Majestic+", "Do 2 urządzeń", "Jakość Full HD", "Majestic+ Originals"]'::jsonb, true, 20),
  ('premiere', 'Premiere', 149, 'USD', 30, 4, '4K', '["Cały katalog Majestic+", "Do 4 urządzeń", "Jakość 4K", "Majestic+ Originals", "Pierwszeństwo przy premierach"]'::jsonb, true, 30)
on conflict (code) do update set
  name = excluded.name,
  price = excluded.price,
  currency = excluded.currency,
  billing_days = excluded.billing_days,
  max_devices = excluded.max_devices,
  quality = excluded.quality,
  features = excluded.features,
  active = excluded.active,
  display_order = excluded.display_order,
  updated_at = now();

create table if not exists public.majestic_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 1000 check (balance >= 0),
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.majestic_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  plan_id uuid not null references public.majestic_subscription_plans(id),
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null,
  auto_renew boolean not null default false,
  payment_source text not null default 'majestic_wallet',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.majestic_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references public.majestic_subscription_plans(id) on delete set null,
  transaction_type text not null default 'subscription_purchase' check (transaction_type in ('subscription_purchase', 'wallet_credit', 'refund', 'admin_adjustment')),
  direction text not null default 'debit' check (direction in ('debit', 'credit')),
  amount integer not null check (amount >= 0),
  currency text not null default 'USD',
  status text not null default 'completed' check (status in ('completed', 'failed', 'refunded')),
  description text not null default '',
  external_reference text,
  created_at timestamptz not null default now()
);

create index if not exists majestic_transactions_user_idx
  on public.majestic_transactions (user_id, created_at desc);

create index if not exists majestic_subscriptions_status_idx
  on public.majestic_subscriptions (status, current_period_end);

alter table public.majestic_subscription_plans enable row level security;
alter table public.majestic_wallets enable row level security;
alter table public.majestic_subscriptions enable row level security;
alter table public.majestic_transactions enable row level security;

drop policy if exists "majestic_plans_read" on public.majestic_subscription_plans;
create policy "majestic_plans_read"
  on public.majestic_subscription_plans for select
  using (active = true);

drop policy if exists "majestic_wallet_select_own" on public.majestic_wallets;
create policy "majestic_wallet_select_own"
  on public.majestic_wallets for select
  using (auth.uid() = user_id);

drop policy if exists "majestic_subscriptions_select_own" on public.majestic_subscriptions;
create policy "majestic_subscriptions_select_own"
  on public.majestic_subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists "majestic_transactions_select_own" on public.majestic_transactions;
create policy "majestic_transactions_select_own"
  on public.majestic_transactions for select
  using (auth.uid() = user_id);

create or replace function public.handle_new_majestic_wallet()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.majestic_wallets (user_id, balance, currency)
  values (new.id, 1000, 'USD')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_majestic_wallet on auth.users;
create trigger on_auth_user_created_majestic_wallet
  after insert on auth.users
  for each row execute procedure public.handle_new_majestic_wallet();

insert into public.majestic_wallets (user_id, balance, currency)
select id, 1000, 'USD' from auth.users
on conflict (user_id) do nothing;

create or replace function public.purchase_majestic_subscription(
  p_user_id uuid,
  p_plan_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.majestic_subscription_plans%rowtype;
  v_wallet public.majestic_wallets%rowtype;
  v_existing public.majestic_subscriptions%rowtype;
  v_period_start timestamptz := now();
  v_period_end timestamptz;
  v_transaction_id uuid;
  v_subscription_id uuid;
begin
  select * into v_plan
  from public.majestic_subscription_plans
  where code = p_plan_code and active = true
  limit 1;

  if v_plan.id is null then
    raise exception 'Plan subskrypcji nie istnieje.';
  end if;

  insert into public.majestic_wallets (user_id, balance, currency)
  values (p_user_id, 1000, v_plan.currency)
  on conflict (user_id) do nothing;

  select * into v_wallet
  from public.majestic_wallets
  where user_id = p_user_id
  for update;

  if v_wallet.balance < v_plan.price then
    raise exception 'Brak wystarczających środków w portfelu.';
  end if;

  select * into v_existing
  from public.majestic_subscriptions
  where user_id = p_user_id
  limit 1;

  if v_existing.id is not null and v_existing.status = 'active' and v_existing.current_period_end > now() then
    v_period_start := v_existing.current_period_start;
    v_period_end := v_existing.current_period_end + make_interval(days => v_plan.billing_days);
  else
    v_period_start := now();
    v_period_end := now() + make_interval(days => v_plan.billing_days);
  end if;

  update public.majestic_wallets
  set balance = balance - v_plan.price,
      updated_at = now()
  where user_id = p_user_id;

  insert into public.majestic_transactions
    (user_id, plan_id, transaction_type, direction, amount, currency, status, description)
  values
    (p_user_id, v_plan.id, 'subscription_purchase', 'debit', v_plan.price, v_plan.currency, 'completed', 'Majestic+ ' || v_plan.name || ' · ' || v_plan.billing_days || ' dni')
  returning id into v_transaction_id;

  insert into public.majestic_subscriptions
    (user_id, plan_id, status, current_period_start, current_period_end, auto_renew, payment_source)
  values
    (p_user_id, v_plan.id, 'active', v_period_start, v_period_end, false, 'majestic_wallet')
  on conflict (user_id) do update set
    plan_id = excluded.plan_id,
    status = 'active',
    current_period_start = v_period_start,
    current_period_end = v_period_end,
    auto_renew = false,
    payment_source = 'majestic_wallet',
    updated_at = now()
  returning id into v_subscription_id;

  return jsonb_build_object(
    'ok', true,
    'subscription_id', v_subscription_id,
    'transaction_id', v_transaction_id,
    'plan_code', v_plan.code,
    'period_end', v_period_end,
    'balance', v_wallet.balance - v_plan.price
  );
end;
$$;

revoke all on function public.purchase_majestic_subscription(uuid, text) from public;
revoke all on function public.purchase_majestic_subscription(uuid, text) from anon;
revoke all on function public.purchase_majestic_subscription(uuid, text) from authenticated;
grant execute on function public.purchase_majestic_subscription(uuid, text) to service_role;
