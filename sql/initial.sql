create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  provider text,
  icon_key text,
  price_cents int not null default 0,
  currency text not null default 'EUR',
  cycle text not null default 'monthly' check (cycle in ('monthly','yearly','custom_days')),
  custom_days int,
  start_date date default current_date,
  next_renewal_date date not null,
  status text not null default 'active' check (status in ('active','paused','canceled')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table subscriptions enable row level security;

create policy if not exists "own_rows"
on subscriptions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists idx_subs_next_renewal_date
  on subscriptions (next_renewal_date, status, user_id);
