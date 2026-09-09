# Ledger Database (Supabase)

Postgres (Supabase) with Row Level Security on every table.

## Applying the schema

Run these in order in the Supabase SQL editor:

1. `database/schema.sql` — `expenses` + `budgets`, base RLS
2. `database/migrations/001_payment_methods.sql` — payment method + currency columns
3. `database/migrations/002_receipts_ocr.sql` — `receipts` table + storage notes
4. `database/migrations/003_recurring_expenses.sql` — `recurring_expenses` templates
5. `database/migrations/004_shared_expenses.sql` — groups, splits, settlements
6. `database/migrations/005_audit_logs.sql` — append-only audit trail

Then optionally `database/seed.sql` (edit the demo email inside first).

## Tables

### expenses
| column | type | notes |
|---|---|---|
| id | uuid pk | default `gen_random_uuid()` |
| user_id | uuid | → `auth.users`, cascade delete |
| amount | numeric(12,2) | must be > 0 |
| category | text | Food, Transport, Shopping, Bills, Entertainment, Health, Education, Other |
| note | text | merchant / free text |
| expense_date | date | defaults to today |
| payment_method | text | cash, upi, credit_card, debit_card, bank_transfer, wallet |
| currency | text | ISO-4217, default INR |
| created_at | timestamptz | |

### budgets
`(user_id, category)` unique. `monthly_limit numeric(12,2) ≥ 0`.

### receipts
Receipt images live in **Supabase Storage**, bucket `receipts` (private).
Create it once:

```sql
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;
```

| column | notes |
|---|---|
| storage_path | path inside the bucket (`<user_id>/<timestamp>.jpg`) |
| expense_id | nullable link to expenses |
| ocr_status | pending / processed / failed |
| ocr_data | jsonb — merchant, total, date, tax, items, category, payment_method, currency |

### recurring_expenses
Templates for rent, subscriptions, EMI… `frequency` ∈ daily/weekly/monthly/yearly,
`next_due_date` drives when the bot/server posts the actual expense.

### groups / group_members / group_expenses / expense_splits / settlements
Shared-expense model: a group has members (joined users or invited emails);
each `group_expense` records who paid, and `expense_splits` holds each member's
share. `settlements` records paybacks. RLS gives members read access and owners
full control.

### audit_logs
Append-only (`bigint identity`), written by the server with the service-role
key. Users can SELECT their own rows; there are no insert/update/delete
policies for anon/authenticated.

## Clerk variant

`database/schema-clerk.sql` is the variant where `user_id` holds a Clerk user
id and RLS matches `auth.jwt()->>'sub'`.
`database/migration-to-clerk-later.sql` migrates an existing project in one run.
See the README section "Switching to Clerk later" before using these.
