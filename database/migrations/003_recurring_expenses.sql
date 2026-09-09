-- 003 — Recurring expenses
-- Templates for rent, subscriptions, internet, EMI etc. The bot/server
-- reads these and creates the actual expense rows on their schedule.

create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  amount numeric(12, 2) not null check (amount > 0),
  category text not null,
  frequency text not null default 'monthly'
    check (frequency in ('daily', 'weekly', 'monthly', 'yearly')),
  next_due_date date not null default current_date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists recurring_user_id_idx on public.recurring_expenses (user_id);
create index if not exists recurring_next_due_idx on public.recurring_expenses (next_due_date)
  where active;

alter table public.recurring_expenses enable row level security;

create policy "Individuals can view their own recurring expenses"
  on public.recurring_expenses for select using (auth.uid() = user_id);
create policy "Individuals can insert their own recurring expenses"
  on public.recurring_expenses for insert with check (auth.uid() = user_id);
create policy "Individuals can update their own recurring expenses"
  on public.recurring_expenses for update using (auth.uid() = user_id);
create policy "Individuals can delete their own recurring expenses"
  on public.recurring_expenses for delete using (auth.uid() = user_id);
