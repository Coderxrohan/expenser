-- 010 — Category sort order
-- Lets users reorder categories from Settings; the order is honored
-- in every dropdown (expense/income forms, filters, bot lists).

alter table public.categories
  add column if not exists sort_order integer not null default 0;

create index if not exists categories_user_sort_idx
  on public.categories (user_id, type, sort_order);
