# Ledger — Expense Manager

A quiet expense manager: dashboard, categorized expenses, budgets, analytics,
a Telegram bot, and receipt OCR. **Supabase** handles auth + database with
Row Level Security; all configuration lives in **`.env`** — nothing is hardcoded.

## Structure

```
client/      Frontend — landing, login, dashboard (pages + css/ + js/)
server/      Express API — routes → controllers → services (src/)
telegram/    Telegram bot — commands, handlers, services
ocr/         Receipt OCR — service, parser, validator
database/    schema.sql, migrations/, seed.sql
reports/     PDF (pdfkit) and CSV services
tests/       node --test suites (expenses, budgets, telegram, ocr)
docs/        API.md, DATABASE.md, TELEGRAM.md
```

## Run it

```bash
npm run install:all        # installs server/ deps (+ optional tesseract.js)
cp .env.example .env       # then fill in the values (see below)
npm start                  # → http://localhost:8000
```

The Express server serves the client and the API under `/api`. `config.js`
is generated from `.env` at runtime — real keys never live in source.

## Setup

1. **`.env`** — copy `.env.example` and fill in:
   - `SUPABASE_URL` and `SUPABASE_ANON_KEY` — Supabase → **Settings → API**.
   - `SUPABASE_SERVICE_ROLE_KEY` — same page; server-side only. Needed for
     receipt storage, the Telegram bot, and audit-log writes.
   - Telegram / OCR / Clerk keys are placeholders for planned features and
     can stay empty for now.
2. **Database** — run `database/schema.sql` in your Supabase SQL editor, then
   the migrations in `database/migrations/` in numeric order (see
   [docs/DATABASE.md](docs/DATABASE.md)). **Migration `006_income.sql` is
   required** — the Income tab uses it. All files are `if not exists`, so
   re-running them is safe.
3. **Telegram** (optional) — see [docs/TELEGRAM.md](docs/TELEGRAM.md).

## What works today

- **Auth** — sign up / log in / log out with Supabase Auth (email + password).
  By default Supabase asks users to confirm email; turn that off under
  **Authentication → Settings** while testing.
- **Dashboard** — monthly total, month-over-month, daily average, category
  donut + breakdown, recent entries
- **Expenses** — add, edit, delete; payment method; filters (search, category,
  date range); CSV + PDF export; JSON backup/restore; bank statement import
- **Income** — same add/edit/delete + filters as expenses, with its own
  sources (Salary, Freelance, Business, Investment, Gift, Other) and an
  "Earned this month" stat on the dashboard
- **Analytics** — daily spending chart, top merchants, category comparison,
  averages (see `GET /api/expenses/analytics`)
- **API** — documented in [docs/API.md](docs/API.md); rate-limited; every
  query runs under RLS with the caller's token
- **Polish** — toasts, confirm dialog, loading screen, busy button states

## Feature modules (wired, ready to enable)

| Feature | Where | Needs in `.env` |
|---|---|---|
| Telegram bot (`/add 500 food`, `/balance`, `/today`, `/month`, `/budget`, `/recent`, free-form, receipt photos → OCR → expense) | `telegram/` | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `LEDGER_OWNER_EMAIL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Receipt OCR → merchant, total, date, tax/GST, items, category, payment method, currency | `ocr/`, `POST /api/receipts` | `OCR_API_KEY` optional — falls back to local tesseract.js |
| Receipt management — store images, view via signed URL, OCR data linked, organize by month/category | `server/src/services/receipt.service.js`, `receipts` bucket | `SUPABASE_SERVICE_ROLE_KEY` |
| Budget alerts & notifications — warnings at 80%/100%, monthly summaries, confirmations, recurring reminders | `telegram/services/notification.service.js` | Telegram vars |
| Recurring expenses — rent, subscriptions, internet, EMI templates | `recurring_expenses` table | — |
| Shared expenses — groups, splits, who paid, owed, settlements | `004_shared_expenses.sql` | — |
| Multi-currency, payment tracking (cash/UPI/cards/transfer/wallet) | `expenses.currency`, `payment_method` | — |
| Audit logs (append-only) | `005_audit_logs.sql` | `SUPABASE_SERVICE_ROLE_KEY` |

Roadmap beyond that: PWA/offline entry with sync, Excel export
(CSV opens fine in Excel today), automatic recurring posting via cron.

## Tests

```bash
npm test    # node --test tests/ — parser, validator, CSV, validation, analytics helpers
```

## Customizing

- **Categories** — the `CATEGORIES` array in `client/js/app.js` (and the
  whitelist in `server/src/utils/validation.js`)
- **Currency** — `CURRENCY` in `client/js/app.js`
- **Colors & fonts** — CSS custom properties at the top of `client/css/style.css`

## Hosting

- **Local / VPS**: `npm start` (port from `PORT`, default 8000). Put nginx or
  Caddy in front for TLS; point the Telegram webhook at
  `/telegram/<TELEGRAM_WEBHOOK_SECRET>`.
- **Static hosts** (GitHub Pages, plain FTP): no server means no `.env` —
  paste values into the fallback `client/config.js`. Don't commit that.

## Switching to Clerk later

Groundwork is kept out of the way:

- `database/schema-clerk.sql` — the variant where `user_id` is the Clerk user
  id and RLS matches `auth.jwt()->>'sub'`.
- `database/migration-to-clerk-later.sql` — one-time migration for the
  existing project (converts `user_id`, rewrites policies).

The switch needs, in `client/`: load `@clerk/clerk-js`, mount `<SignIn>` on
the auth screen, and pass a Clerk token to Supabase via
`createClient(..., { accessToken: async () => Clerk.session.getToken({ template: "supabase" }) })`.
Also create the built-in **Supabase** JWT template in the Clerk dashboard
(paste your Supabase JWT secret) and run the migration. Your Clerk
publishable key is already reserved in `.env`.

Note: rows created under Supabase login keep their uuid `user_id`, so they
stop matching Clerk identities after a switch — export first if needed.
