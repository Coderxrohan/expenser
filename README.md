# Ledger — Expense Manager

A full expense manager with email/password login, categorized expenses, a
dashboard, filters, and monthly budgets — backed by Supabase.

**This copy is already connected to your Supabase project** (`config.js` has
your real project URL and anon key) and the `expenses`/`budgets` tables with
Row Level Security are already created — nothing to set up, just run it.

If you ever want to point it at a different Supabase project: run
`schema.sql` in that project's SQL Editor, then update the two values in
`config.js`.

## Run it

This is a static site — no build step. Either:

- Open `index.html` directly in a browser, or
- Serve the folder locally, e.g. `python3 -m http.server`, then visit
  `http://localhost:8000`, or
- Deploy the folder as-is to Netlify, Vercel, GitHub Pages, or Supabase's own
  static hosting.

## What's included

- **Auth** — sign up / log in / log out with Supabase Auth
- **Dashboard** — this month's total, day-over-day comparison to last month,
  daily average, a category donut chart + breakdown bars, and recent entries
- **Expenses** — add, edit, delete; filter by search text, category, and
  date range
- **Budgets** — set a monthly limit per category and see live progress bars
  against what you've actually spent
- **Polish** — toast notifications for saves/deletes/errors, a proper
  confirm dialog (no browser popups), a loading screen while data loads,
  and disabled/"Saving…" button states so nothing feels unresponsive

Note: by default Supabase requires email confirmation on sign-up. If you'd
rather test without checking your inbox each time, turn off "Confirm email"
under **Authentication > Settings** in your Supabase project.

## Customizing

- **Categories** live in the `CATEGORIES` array at the top of `app.js` —
  add, remove, or rename as you like.
- **Currency symbol** is the `CURRENCY` constant in `app.js` (defaults to ₹).
- **Colors and fonts** are all CSS custom properties at the top of
  `style.css` under `:root`.
