-- ============================================================
-- Ledger — one-time migration to Clerk login
-- Run once in your EXISTING Supabase project's SQL editor
-- (Database → SQL Editor). New projects should run schema.sql instead.
--
-- What it does:
--   1. Drops the foreign keys to Supabase's auth.users
--   2. Converts user_id from uuid to text (Clerk user ids)
--   3. Rewrites the RLS policies to match on the JWT "sub"
--      claim, which is the Clerk user id
--
-- Note: rows created under the old Supabase email/password login
-- keep their old uuid user_ids, so they will no longer match any
-- Clerk user. Export them first if you need to keep them.
-- ============================================================

alter table public.expenses drop constraint if exists expenses_user_id_fkey;
alter table public.budgets  drop constraint if exists budgets_user_id_fkey;

alter table public.expenses alter column user_id type text using user_id::text;
alter table public.budgets  alter column user_id type text using user_id::text;

drop policy if exists "Individuals can view their own expenses"   on public.expenses;
drop policy if exists "Individuals can insert their own expenses" on public.expenses;
drop policy if exists "Individuals can update their own expenses" on public.expenses;
drop policy if exists "Individuals can delete their own expenses" on public.expenses;
drop policy if exists "Individuals can view their own budgets"    on public.budgets;
drop policy if exists "Individuals can insert their own budgets"  on public.budgets;
drop policy if exists "Individuals can update their own budgets"  on public.budgets;
drop policy if exists "Individuals can delete their own budgets"  on public.budgets;

create policy "Individuals can view their own expenses"
  on public.expenses for select
  using (auth.jwt()->>'sub' = user_id);

create policy "Individuals can insert their own expenses"
  on public.expenses for insert
  with check (auth.jwt()->>'sub' = user_id);

create policy "Individuals can update their own expenses"
  on public.expenses for update
  using (auth.jwt()->>'sub' = user_id);

create policy "Individuals can delete their own expenses"
  on public.expenses for delete
  using (auth.jwt()->>'sub' = user_id);

create policy "Individuals can view their own budgets"
  on public.budgets for select
  using (auth.jwt()->>'sub' = user_id);

create policy "Individuals can insert their own budgets"
  on public.budgets for insert
  with check (auth.jwt()->>'sub' = user_id);

create policy "Individuals can update their own budgets"
  on public.budgets for update
  using (auth.jwt()->>'sub' = user_id);

create policy "Individuals can delete their own budgets"
  on public.budgets for delete
  using (auth.jwt()->>'sub' = user_id);
