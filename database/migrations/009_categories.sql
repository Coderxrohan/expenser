-- 009 — Per-user categories (expense + income)
-- Custom category names managed from the Connectors → Settings panel.
-- The server seeds the built-in defaults the first time a user fetches
-- their categories, so every row here is fully editable/deletable.

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('expense', 'income')),
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, type, name)
);

create index if not exists categories_user_type_idx on public.categories (user_id, type);

alter table public.categories enable row level security;

create policy "Users can view their own categories"
  on public.categories for select using (auth.uid() = user_id);
create policy "Users can add their own categories"
  on public.categories for insert with check (auth.uid() = user_id);
create policy "Users can update their own categories"
  on public.categories for update using (auth.uid() = user_id);
create policy "Users can delete their own categories"
  on public.categories for delete using (auth.uid() = user_id);
