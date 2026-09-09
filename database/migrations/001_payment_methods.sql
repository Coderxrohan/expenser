-- 001 — Payment methods
-- Adds payment_method to expenses (cash, UPI, cards, bank transfer, wallet)
-- and a currency column for multi-currency support.

alter table public.expenses
  add column if not exists payment_method text not null default 'cash'
    check (payment_method in ('cash', 'upi', 'credit_card', 'debit_card', 'bank_transfer', 'wallet')),
  add column if not exists currency text not null default 'INR';

create index if not exists expenses_payment_method_idx on public.expenses (payment_method);
