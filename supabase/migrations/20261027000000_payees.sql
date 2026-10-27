-- People and businesses money moves to and from (payees), and a link from each
-- transaction to its payee. A payee row holds the name the user chose; renaming it
-- renames every linked transaction and every later import from the same payee.

-- ---------- transactions.payee_key ----------
-- 'upi:<handle before @>' for UPI payments, 'name:<lowercased name>' otherwise.
alter table public.transactions
  add column payee_key text
    check (payee_key is null or (char_length(payee_key) between 5 and 120 and payee_key ~ '^(upi|name):'));

create index transactions_user_payee_idx on public.transactions (user_id, payee_key)
  where payee_key is not null;

grant insert (payee_key), update (payee_key) on public.transactions to authenticated;

-- ---------- payees ----------
create table public.payees (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key        text not null check (char_length(key) between 5 and 120 and key ~ '^(upi|name):'),
  name       text not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);

create trigger payees_updated_at before update on public.payees
  for each row execute function public.set_updated_at();

alter table public.payees enable row level security;
create policy "own payees" on public.payees for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.payees from anon, authenticated;
grant select, delete on public.payees to authenticated;
grant insert (key, name), update (name) on public.payees to authenticated;

-- ---------- backfill imported UPI rows ----------
-- Link earlier imports to their UPI handle and fingerprint them by payee instead of by
-- description, matching what the API now computes, so renaming never breaks duplicate checks.
update public.transactions
set payee_key = 'upi:' || lower(substring(notes from '([A-Za-z0-9._-]+)@'))
where source = 'import'
  and payee_key is null
  and substring(notes from '([A-Za-z0-9._-]+)@') is not null
  and char_length(substring(notes from '([A-Za-z0-9._-]+)@')) between 1 and 116;

with fresh as (
  select id, user_id, encode(
    sha256(convert_to(
      to_char(date at time zone 'UTC', 'YYYY-MM-DD') || '|' || type || '|' ||
      to_char(amount, 'FM999999999990.00') || '|' || payee_key,
      'UTF8')),
    'hex') as hash
  from public.transactions
  where source = 'import' and payee_key is not null and import_hash is not null
), ranked as (
  -- Two rows that would share a fingerprint keep their old one (both stay in the ledger).
  select id, hash, count(*) over (partition by user_id, hash) as n from fresh
)
update public.transactions t
set import_hash = r.hash
from ranked r
where t.id = r.id
  and r.n = 1
  and not exists (
    select 1 from public.transactions o
    where o.user_id = t.user_id and o.import_hash = r.hash and o.id <> t.id
  );
