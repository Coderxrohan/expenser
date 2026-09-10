-- 011 — Transaction name
-- Every expense/income gets a short required name (what it was for),
-- shown in the lists instead of the note. The note stays as an
-- optional extra detail.
--
-- The API reads/writes the merged `transactions` table.

alter table public.transactions add column if not exists name text;

-- Backfill: use the note when it has text, otherwise the category.
update public.transactions
  set name = coalesce(nullif(trim(note), ''), category, 'Unnamed')
  where name is null;

alter table public.transactions alter column name set not null;
