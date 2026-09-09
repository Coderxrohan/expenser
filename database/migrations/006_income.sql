-- 006 — Income
-- Income entries mirror expenses: amount, category/source, note, date.

create table if not exists public.incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  category text not null,
  note text,
  income_date date not null default current_date,
  currency text not null default 'INR',
  created_at timestamptz not null default now()
);

create index if not exists incomes_user_id_idx on public.incomes (user_id);
create index if not exists incomes_date_idx on public.incomes (income_date);

alter table public.incomes enable row level security;

create policy "Individuals can view their own incomes"
  on public.incomes for select using (auth.uid() = user_id);
create policy "Individuals can insert their own incomes"
  on public.incomes for insert with check (auth.uid() = user_id);
create policy "Individuals can update their own incomes"
  on public.incomes for update using (auth.uid() = user_id);
create policy "Individuals can delete their own incomes"
  on public.incomes for delete using (auth.uid() = user_id);
