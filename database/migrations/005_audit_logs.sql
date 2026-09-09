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
