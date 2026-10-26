-- Features: transaction notes, payment method and CSV import, richer profile
-- preferences, and self-service account deletion.
-- RLS policies from the init migration already cover the new columns; access is
-- widened only through explicit column-level grants below.

-- ---------- transactions ----------
alter table public.transactions
  add column notes          text not null default '' check (char_length(notes) <= 500),
  add column payment_method text not null default 'other'
    check (payment_method in ('upi', 'card', 'cash', 'bank', 'wallet', 'other')),
  add column source         text not null default 'manual' check (source in ('manual', 'import')),
  add column import_hash    text check (char_length(import_hash) <= 64);

-- One imported row per fingerprint per user; manual rows (null hash) are never constrained.
create unique index transactions_user_import_hash_key
  on public.transactions (user_id, import_hash)
  where import_hash is not null;

-- notes and payment_method are editable; source and import_hash are set once at insert.
grant insert (notes, payment_method, source, import_hash),
      update (notes, payment_method) on public.transactions to authenticated;

-- ---------- profiles ----------
alter table public.profiles
  add column month_start_day       smallint not null default 1 check (month_start_day between 1 and 28),
  add column date_format           text not null default 'DD/MM/YYYY'
    check (date_format in ('DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD')),
  add column week_start            text not null default 'monday' check (week_start in ('monday', 'sunday')),
  add column monthly_income_target numeric(14, 2)
    check (monthly_income_target is null or monthly_income_target > 0),
  add column budget_alerts         boolean not null default true;

grant update (month_start_day, date_format, week_start, monthly_income_target, budget_alerts)
  on public.profiles to authenticated;

-- ---------- account deletion ----------
-- Deletes the caller's auth user; foreign keys with on delete cascade remove the
-- profile, transactions, budgets and savings goals. Only ever touches auth.uid().
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  delete from auth.users where id = caller;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
