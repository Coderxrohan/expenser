# Run Instructions — Ledger (Expenser)

Expense manager: dashboard, income/expense tracking, Telegram bot, receipt OCR.

Frontend: **Next.js** (App Router, at the repo root). Backend: **Express + Supabase** (`server/`).

## 1. Install dependencies (first time only)

```bash
npm run install:all
```

If the optional packages get skipped by npm, install them explicitly:

```bash
npm install @supabase/supabase-js dotenv pdfkit tesseract.js
```

## 2. Environment variables

`.env` in the project root (server-side, plus anything the Telegram bot needs):

```
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
TELEGRAM_BOT_TOKEN=...   # optional — bot is disabled without it
```

`.env.local` in the project root (frontend, public anon key — prefixed for Next.js):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## 3. Run

| Command         | What it does                                                              |
|-----------------|---------------------------------------------------------------------------|
| `npm run dev`   | Run everything: Next.js on **http://localhost:3000** + API on **:8000**    |
| `npm run dev:web` | Next.js frontend only (proxies `/api` to :8000)                          |
| `npm run dev:api` | Express API only (http://localhost:8000)                                 |
| `npm run build` / `npm start` | Production build / serve of the Next.js app                  |
| `npm run bot`   | Run the Telegram bot standalone                                            |
| `npm test`      | Run tests                                                                  |

## 4. Notes

- Open **http://localhost:3000** — the Next.js app proxies `/api/*` to the Express server on :8000 in development.
- Node 20 works but shows a deprecation warning from supabase-js; Node 22+ is recommended.
- Database migrations live in `database/`.
- On Vercel: the Next.js app is the site; `api/index.js` runs the Express API as the `/api` serverless function.
