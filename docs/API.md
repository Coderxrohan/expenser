# Ledger API

Base URL: `http://localhost:8000/api`

All endpoints (except `GET /health`) require a **Supabase access token**:

```
Authorization: Bearer <supabase-access-token>
```

The token comes from Supabase Auth (the web app gets it after login via
`sb.auth.getSession()`). Every query runs under Row Level Security — a user
can only ever touch their own rows.

## Health

### `GET /health`
Returns `{ ok: true, ts: "…" }`.

## Expenses

### `GET /expenses`
Query params: `from`, `to` (YYYY-MM-DD), `category`, `search` (matches note),
`limit` (max 1000). Returns `{ expenses: [...] }` sorted by date desc.

### `GET /expenses/:id`
Returns `{ expense: {...} }` or 404.

### `POST /expenses`
Body:

```json
{
  "amount": 250.00,
  "category": "Food",
  "expense_date": "2026-09-09",
  "note": "lunch",
  "payment_method": "upi",
  "currency": "INR"
}
```

`category` must be one of: Food, Transport, Shopping, Bills, Entertainment,
Health, Education, Other. `payment_method` must be one of: cash, upi,
credit_card, debit_card, bank_transfer, wallet. Returns `201 { expense }`.

### `PATCH /expenses/:id`
Partial update — any subset of the POST fields. Returns `{ expense }`.

### `DELETE /expenses/:id`
Returns `{ deleted: "<id>" }`.

### `GET /expenses/analytics`
Full analytics pack for the current month:

- `monthTotal`, `lastMonthTotal`, `monthOverMonth` (%)
- `dailyAverage`, `transactionCount`, `averagePerTransaction`
- `dailySeries` — `[{ date, amount }]` for the month
- `byCategory` — `[{ category, amount }]`
- `categoryComparison` — `[{ category, thisMonth, lastMonth }]`
- `topMerchants` — `[{ merchant, amount }]` (from notes)

## Budgets

### `GET /budgets`
Returns `{ budgets: [...] }`.

### `GET /budgets/status`
Budgets with live progress: `[{ category, monthly_limit, spent, percent, warning, remaining }]`
where `warning` is `ok`, `near-limit` (≥ 80%) or `exceeded`.

### `POST /budgets` (or `PUT /budgets`)
Body: `{ "category": "Food", "monthly_limit": 4000 }`. Upserts on
(user, category). Returns `{ budget }`.

### `DELETE /budgets/:id`
Returns `{ deleted: "<id>" }`.

## Receipts

### `GET /receipts`
Query: `month` (YYYY-MM), `category`. Returns receipts with their linked
expense summary and `ocr_data`.

### `GET /receipts/:id`
Single receipt.

### `GET /receipts/:id/view`
Returns a short-lived signed URL to the stored image (`viewUrl`).
Requires `SUPABASE_SERVICE_ROLE_KEY` on the server.

### `POST /receipts`
`multipart/form-data` with a `receipt` file field (JPEG/PNG/WebP/PDF, ≤ 8 MB)
and optional `expense_id`. If OCR is configured the parsed fields are stored
as `ocr_data` in the same call.

### `PATCH /receipts/:id/ocr`
Attach/update OCR data: `{ "ocr_data": {...}, "expense_id": "…" }`.

### `DELETE /receipts/:id`
Removes the row and the storage object.

## Reports

### `GET /reports/expenses.csv`
Query: `from`, `to`. Streams a CSV.

### `GET /reports/expenses.pdf`
Query: `from`, `to`. Streams a PDF report (totals, category and payment
method breakdowns, transaction table).

### `GET /reports/backup`
Full JSON backup of the user's expenses + budgets.

### `POST /reports/restore`
Body: a backup JSON (from `GET /reports/backup`). Inserts the expenses.

### `POST /reports/bank-import`
Body: raw CSV text (`Content-Type: text/csv`) with at least
`date` and `amount` columns (description optional). Imports each row as an
"Other" expense with `payment_method: bank_transfer`. Returns `{ imported }`.

## Telegram webhook

`POST /telegram/<TELEGRAM_WEBHOOK_SECRET>` — Telegram update payloads.
Mounted only when `TELEGRAM_BOT_TOKEN` is set (see docs/TELEGRAM.md).

## Errors

All errors come back as `{ "error": "message" }` with a 4xx/5xx status.
Rate limits: 120 req/min general, 20 req/min for reports and receipts.
