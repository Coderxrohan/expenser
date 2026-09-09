-- ======================================================
-- Ledger — all-in-one schema (schema.sql + migrations 001-007)
-- Paste this whole file into the Supabase SQL Editor and run,
-- or give it to an assistant connected to this project.
-- Safe to re-run (idempotent).
-- ======================================================

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


-- ======================================================
-- migrations/001_payment_methods.sql
-- ======================================================
-- 001 — Payment methods
-- Adds payment_method to expenses (cash, UPI, cards, bank transfer, wallet)
-- and a currency column for multi-currency support.

alter table public.expenses
  add column if not exists payment_method text not null default 'cash'
    check (payment_method in ('cash', 'upi', 'credit_card', 'debit_card', 'bank_transfer', 'wallet')),
  add column if not exists currency text not null default 'INR';

create index if not exists expenses_payment_method_idx on public.expenses (payment_method);


-- ======================================================
-- migrations/002_receipts_ocr.sql
-- ======================================================
-- 002 — Receipts & OCR data
-- Receipt images live in Supabase Storage (bucket: receipts).
-- The OCR parse result is kept in ocr_data, linked to its expense.

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  expense_id uuid references public.expenses (id) on delete set null,
  storage_path text not null,             -- path inside the receipts bucket
  mime_type text not null default 'image/jpeg',
  ocr_status text not null default 'pending'
    check (ocr_status in ('pending', 'processed', 'failed')),
  ocr_data jsonb,                          -- merchant, total, date, tax, items, category, payment_method, currency
  created_at timestamptz not null default now()
);

create index if not exists receipts_user_id_idx on public.receipts (user_id);
create index if not exists receipts_expense_id_idx on public.receipts (expense_id);

alter table public.receipts enable row level security;

create policy "Individuals can view their own receipts"
  on public.receipts for select using (auth.uid() = user_id);
create policy "Individuals can insert their own receipts"
  on public.receipts for insert with check (auth.uid() = user_id);
create policy "Individuals can update their own receipts"
  on public.receipts for update using (auth.uid() = user_id);
create policy "Individuals can delete their own receipts"
  on public.receipts for delete using (auth.uid() = user_id);


-- ======================================================
-- migrations/003_recurring_expenses.sql
-- ======================================================
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


-- ======================================================
-- migrations/004_shared_expenses.sql
-- ======================================================
-- 004 — Shared expenses (groups, splits, settlements)
-- A group has members; each expense can be split across members.
-- balances/settlements are computed from expense_splits (who paid vs who owes).

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,  -- null = invited by email, not joined yet
  email text not null,
  role text not null default 'member' check (role in ('owner', 'member')),
  unique (group_id, email)
);

create table if not exists public.group_expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  paid_by uuid references auth.users (id) on delete set null, -- who paid
  description text not null,
  amount numeric(12, 2) not null check (amount > 0),
  expense_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.expense_splits (
  id uuid primary key default gen_random_uuid(),
  group_expense_id uuid not null references public.group_expenses (id) on delete cascade,
  member_email text not null,
  share numeric(12, 2) not null check (share >= 0)
);

create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  from_email text not null,   -- who paid back
  to_email text not null,     -- who got paid
  amount numeric(12, 2) not null check (amount > 0),
  settled_at timestamptz not null default now()
);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_expenses enable row level security;
alter table public.expense_splits enable row level security;
alter table public.settlements enable row level security;

create policy "Group members can view their groups"
  on public.groups for select
  using (
    auth.uid() = owner_id
    or exists (
      select 1 from public.group_members m
      where m.group_id = groups.id
        and (m.user_id = auth.uid() or m.email = auth.jwt()->>'email')
    )
  );
create policy "Owners manage their groups"
  on public.groups for all using (auth.uid() = owner_id);

create policy "Members can view group membership"
  on public.group_members for select
  using (
    exists (
      select 1 from public.groups g
      join public.group_members me on me.group_id = g.id
      where g.id = group_id
        and (me.user_id = auth.uid() or me.email = auth.jwt()->>'email')
    )
    or exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())
  );
create policy "Group members insert membership"
  on public.group_members for insert
  with check (
    exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())
  );
create policy "Group members delete membership"
  on public.group_members for delete
  using (
    exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())
    or user_id = auth.uid()
    or email = auth.jwt()->>'email'
  );

create policy "Members can view group expenses"
  on public.group_expenses for select
  using (
    exists (
      select 1 from public.groups g
      join public.group_members me on me.group_id = g.id
      where g.id = group_id
        and (me.user_id = auth.uid() or me.email = auth.jwt()->>'email')
    )
    or exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())
  );
create policy "Members can add group expenses"
  on public.group_expenses for insert
  with check (
    exists (
      select 1 from public.group_members m
      where m.group_id = group_id and m.user_id = auth.uid()
    )
    or exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())
  );
create policy "Members can delete their group expenses"
  on public.group_expenses for delete
  using (
    paid_by = auth.uid()
    or exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())
  );

create policy "Splits follow their expense"
  on public.expense_splits for all
  using (
    exists (
      select 1 from public.group_expenses ge
      join public.group_members m on m.group_id = ge.group_id
      where ge.id = group_expense_id
        and (m.user_id = auth.uid() or m.email = auth.jwt()->>'email')
    )
    or exists (
      select 1 from public.group_expenses ge
      join public.groups g on g.id = ge.group_id
      where ge.id = group_expense_id and g.owner_id = auth.uid()
    )
  );

create policy "Members can view settlements"
  on public.settlements for select
  using (
    exists (
      select 1 from public.group_members m
      where m.group_id = group_id
        and (m.user_id = auth.uid() or m.email = auth.jwt()->>'email')
    )
    or exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())
  );
create policy "Members can record settlements"
  on public.settlements for insert
  with check (
    exists (
      select 1 from public.group_members m
      where m.group_id = group_id and m.user_id = auth.uid()
    )
  );


-- ======================================================
-- migrations/005_audit_logs.sql
-- ======================================================
-- 005 — Audit log
-- Append-only trail of sensitive actions (login, deletes, exports…).
-- Written by the server via the service-role key; users can read their own.

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  action text not null,            -- e.g. expense.delete, receipt.upload, export.csv
  entity text,                     -- e.g. expenses, budgets
  entity_id text,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_user_created_idx on public.audit_logs (user_id, created_at desc);

alter table public.audit_logs enable row level security;

create policy "Users can read their own audit logs"
  on public.audit_logs for select using (auth.uid() = user_id);
-- No insert/update/delete policies: only the server (service role) writes.


-- ======================================================
-- migrations/006_income.sql
-- ======================================================
-- 006 — Income
-- Income entries mirror expenses: amount, category/source, note, date.

create table if not exists public.incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  category text not null,
  note text,
  income_date date not null default current_date,
  payment_method text not null default 'cash'
    check (payment_method in ('cash', 'upi', 'credit_card', 'debit_card', 'bank_transfer', 'wallet')),
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


-- ======================================================
-- migrations/007_income_payment_method.sql
-- ======================================================
-- 007 — Payment method on incomes (for projects that already ran 006
-- before the column was added there; safe to re-run).

alter table public.incomes
  add column if not exists payment_method text not null default 'cash'
    check (payment_method in ('cash', 'upi', 'credit_card', 'debit_card', 'bank_transfer', 'wallet'));


-- ======================================================
-- migrations/008_receipts_bucket.sql
-- ======================================================
-- 008 — Receipts storage bucket (private)
create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- Storage policies: users can only touch files under their own folder.
create policy "Users read their own receipts"
  on storage.objects for select
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users upload their own receipts"
  on storage.objects for insert
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users delete their own receipts"
  on storage.objects for delete
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
