# Run Instructions — Ledger (Expenser)

Expense manager: dashboard, income/expense tracking, Telegram bot, receipt OCR.

## 1. Install dependencies (first time only)

```bash
npm run install:all
```

If the optional packages get skipped by npm, install them explicitly:

```bash
npm install @supabase/supabase-js dotenv pdfkit tesseract.js
```

## 2. Environment variables

Create a `.env` file in the project root (copy from `.env.example` if present):

```
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
TELEGRAM_BOT_TOKEN=...   # optional — bot is disabled without it
```

## 3. Run

| Command            | What it does                                  |
|--------------------|-----------------------------------------------|
| `npm start`        | Start the server → http://localhost:8000      |
| `npm run dev`      | Start with auto-restart on file changes       |
| `npm run bot`      | Run the Telegram bot standalone               |
| `npm test`         | Run tests                                     |

## 4. Notes

- Server runs on **http://localhost:8000**.
- Node 20 works but shows a deprecation warning from supabase-js; Node 22+ is recommended.
- Database migrations live in `database/`.
