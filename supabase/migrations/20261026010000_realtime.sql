-- Stream row changes to signed-in clients (Supabase Realtime). RLS still decides who sees which rows.
alter publication supabase_realtime add table public.transactions, public.budgets, public.savings_goals;
