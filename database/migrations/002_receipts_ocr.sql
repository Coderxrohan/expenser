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
