-- ============================================================
-- Ledger — seed data (demo)
-- Run AFTER schema.sql + all migrations, for the signed-in user
-- whose email you set below. Safe to re-run (skips existing).
-- ============================================================

do $$
declare
  uid uuid;
begin
  select id into uid from auth.users where email = 'demo@example.com' limit 1;
  if uid is null then
    raise notice 'No user demo@example.com found — sign up first, then re-run.';
    return;
  end if;

  -- expenses (only added if the table is empty for this user)
  if not exists (select 1 from public.expenses where user_id = uid) then
    insert into public.expenses (user_id, amount, category, note, expense_date, payment_method) values
      (uid, 320.00, 'Food',         'Groceries — weekly',      current_date - 1,  'upi'),
      (uid, 60.00,  'Transport',    'Metro card top-up',       current_date - 1,  'wallet'),
      (uid, 450.00, 'Bills',        'Internet — monthly',      current_date - 2,  'bank_transfer'),
      (uid, 18000.00,'Bills',       'Rent',                    current_date - 3,  'bank_transfer'),
      (uid, 240.00, 'Entertainment','Cinema tickets',          current_date - 4,  'credit_card'),
      (uid, 540.00, 'Shopping',     'Running shoes',           current_date - 6,  'credit_card'),
      (uid, 95.00,  'Food',         'Lunch with team',         current_date - 7,  'upi'),
      (uid, 1300.00,'Health',       'Dentist',                 current_date - 10, 'cash'),
      (uid, 75.00,  'Food',         'Coffee + pastry',         current_date - 12, 'cash');
  end if;

  -- budgets
  insert into public.budgets (user_id, category, monthly_limit) values
    (uid, 'Food',         4000),
    (uid, 'Transport',    1500),
    (uid, 'Entertainment',2000)
  on conflict (user_id, category) do nothing;

  -- recurring templates
  insert into public.recurring_expenses (user_id, label, amount, category, frequency, next_due_date) values
    (uid, 'Rent',          18000, 'Bills',  'monthly', date_trunc('month', current_date) + interval '1 month' + interval '4 days'),
    (uid, 'Internet',        450, 'Bills',  'monthly', date_trunc('month', current_date) + interval '1 month' + interval '2 days'),
    (uid, 'Streaming subs',  499, 'Entertainment', 'monthly', date_trunc('month', current_date) + interval '1 month' + interval '15 days')
  on conflict do nothing;
end
$$;
