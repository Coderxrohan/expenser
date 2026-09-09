-- 007 — Payment method on incomes (for projects that already ran 006
-- before the column was added there; safe to re-run).

alter table public.incomes
  add column if not exists payment_method text not null default 'cash'
    check (payment_method in ('cash', 'upi', 'credit_card', 'debit_card', 'bank_transfer', 'wallet'));
