-- 008 — Telegram chat links (multi-user bot)
-- Maps a Telegram chat_id to a Ledger account so the shared bot
-- responds as that user. Run in the Supabase SQL editor.

create table if not exists public.telegram_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  chat_id text not null unique,
  label text,
  created_at timestamptz not null default now()
);

create index if not exists telegram_links_user_id_idx on public.telegram_links (user_id);
create index if not exists telegram_links_chat_id_idx on public.telegram_links (chat_id);

alter table public.telegram_links enable row level security;

create policy "Users can view their own telegram links"
  on public.telegram_links for select using (auth.uid() = user_id);
create policy "Users can add their own telegram links"
  on public.telegram_links for insert with check (auth.uid() = user_id);
create policy "Users can remove their own telegram links"
  on public.telegram_links for delete using (auth.uid() = user_id);
