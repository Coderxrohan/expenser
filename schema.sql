-- ============================================================
-- Ledger — Supabase schema
-- Run this in your Supabase project's SQL editor (Database > SQL Editor)
-- ============================================================

-- Categories are fixed in the app, but stored as text so you can add your own.
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  category text not null,
  note text,
  expense_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists expenses_user_id_idx on public.expenses (user_id);
create index if not exists expenses_date_idx on public.expenses (expense_date);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null,
  monthly_limit numeric(12, 2) not null check (monthly_limit >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, category)
);

-- ============================================================
-- Row Level Security — every user can only ever see their own rows
-- ============================================================
alter table public.expenses enable row level security;
alter table public.budgets enable row level security;

create policy "Individuals can view their own expenses"
  on public.expenses for select
  using (auth.uid() = user_id);

create policy "Individuals can insert their own expenses"
  on public.expenses for insert
  with check (auth.uid() = user_id);

create policy "Individuals can update their own expenses"
  on public.expenses for update
  using (auth.uid() = user_id);

create policy "Individuals can delete their own expenses"
  on public.expenses for delete
  using (auth.uid() = user_id);

create policy "Individuals can view their own budgets"
  on public.budgets for select
  using (auth.uid() = user_id);

create policy "Individuals can insert their own budgets"
  on public.budgets for insert
  with check (auth.uid() = user_id);

create policy "Individuals can update their own budgets"
  on public.budgets for update
  using (auth.uid() = user_id);

create policy "Individuals can delete their own budgets"
  on public.budgets for delete
  using (auth.uid() = user_id);
