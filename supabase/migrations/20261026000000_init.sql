-- FinTrack schema: profiles, transactions, budgets, savings goals.
-- Every table is protected by Row Level Security: a signed-in user can only
-- see and change rows where user_id = auth.uid(). The anon role gets nothing.

-- ---------- helpers ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- profiles (1:1 with auth.users) ----------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  name          text not null default '' check (char_length(name) <= 60),
  theme         text not null default 'light' check (theme in ('light', 'dark')),
  currency      text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  notifications boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Create the profile automatically when someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'name', ''), 60));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- transactions ----------
create table public.transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type        text not null check (type in ('income', 'expense')),
  category    text not null check (char_length(category) between 1 and 50),
  amount      numeric(14, 2) not null check (amount > 0),
  description text not null default '' check (char_length(description) <= 200),
  date        timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index transactions_user_date_idx on public.transactions (user_id, date desc);

-- ---------- budgets (one per category per user) ----------
create table public.budgets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category     text not null check (char_length(category) between 1 and 50),
  limit_amount numeric(14, 2) not null check (limit_amount > 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, category)
);

-- ---------- savings goals ----------
create table public.savings_goals (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title          text not null check (char_length(title) between 1 and 100),
  target_amount  numeric(14, 2) not null check (target_amount > 0),
  current_amount numeric(14, 2) not null default 0 check (current_amount >= 0),
  category       text check (char_length(category) <= 50),
  due_date       date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index savings_goals_user_idx on public.savings_goals (user_id);

-- ---------- updated_at triggers ----------
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger transactions_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();
create trigger budgets_updated_at before update on public.budgets
  for each row execute function public.set_updated_at();
create trigger savings_goals_updated_at before update on public.savings_goals
  for each row execute function public.set_updated_at();

-- ---------- Row Level Security ----------
alter table public.profiles      enable row level security;
alter table public.transactions  enable row level security;
alter table public.budgets       enable row level security;
alter table public.savings_goals enable row level security;

create policy "own profile: read"   on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "own profile: update" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "own transactions" on public.transactions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own budgets" on public.budgets for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own savings goals" on public.savings_goals for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------- grants (new tables are not exposed automatically) ----------
-- Column-level insert/update grants: user_id, id and timestamps are never client-writable
-- (user_id always comes from the token via its default).
revoke all on public.profiles, public.transactions, public.budgets, public.savings_goals from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (name, theme, currency, notifications) on public.profiles to authenticated;

grant select, delete on public.transactions to authenticated;
grant insert (type, category, amount, description, date),
      update (type, category, amount, description, date) on public.transactions to authenticated;

grant select, delete on public.budgets to authenticated;
grant insert (category, limit_amount), update (category, limit_amount) on public.budgets to authenticated;

grant select, delete on public.savings_goals to authenticated;
grant insert (title, target_amount, current_amount, category, due_date),
      update (title, target_amount, current_amount, category, due_date) on public.savings_goals to authenticated;
