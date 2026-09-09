# Ledger Telegram Bot

Log expenses from chat, send receipt photos for OCR, get budget warnings.

## Setup

1. **Create the bot** — chat with [@BotFather](https://t.me/BotFather) →
   `/newbot` → copy the token.
2. **`.env`** (repo root):

   ```ini
   TELEGRAM_BOT_TOKEN=123456:ABC-your-token
   TELEGRAM_CHAT_ID=            # filled in step 3
   TELEGRAM_WEBHOOK_SECRET=some-random-string
   LEDGER_OWNER_EMAIL=you@example.com
   SUPABASE_SERVICE_ROLE_KEY=   # service role key — server-side only
   ```

3. **Find your chat id** — message your bot anything, then open
   `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy
   `message.chat.id` into `TELEGRAM_CHAT_ID`.

   (The bot is private: it ignores every chat except `TELEGRAM_CHAT_ID`.)
4. `LEDGER_OWNER_EMAIL` links the bot to your Ledger account — the bot acts
   as that user when writing expenses.

## Running

Webhook mode (with the API server):

```
node server/src/server.js
# then point BotFather's webhook at:
#   https://your-domain/telegram/<TELEGRAM_WEBHOOK_SECRET>
```

Polling mode (dev, standalone):

```
node telegram/bot.js
```

## Commands

| Command | What it does |
|---|---|
| `/start` | Link the chat, show help |
| `/add 500 food lunch with team` | Add an expense (amount, category, optional note) |
| `/balance` | Spending vs budget for this month |
| `/today` | Today's entries + total |
| `/month` | Monthly summary: total, MoM, top categories, daily average |
| `/budget` | Budget bars; inline buttons let you set a limit (send the amount next) |
| `/recent` | Last 10 expenses |

Free-form input works too — a plain message like `220 transport auto fare`
is treated as `/add`.

## Receipt photos

Send a photo of a receipt:

1. The bot downloads it and runs OCR (`/ocr`) — locally via tesseract.js, or
   through an external API if `OCR_API_KEY` is set.
2. It replies with the parsed fields: merchant, total, date, tax, category,
   payment method — plus validation warnings if anything looks off.
3. Confirm to save: the expense is created, the image is stored in the
   `receipts` bucket and the OCR data is linked to the transaction.

## Notifications

The bot also pushes proactively (single configured chat):

- **Budget warnings** — when a category crosses 80% or exceeds its limit
- **Monthly summaries** — total, comparison, daily average
- **Expense confirmations** — after each saved expense
- **Recurring reminders** — upcoming rent / subscriptions / EMI from
  `recurring_expenses`

Trigger these from your own scripts:

```js
const notification = require("./telegram/services/notification.service");
await notification.budgetWarning(statusRows); // from GET /api/budgets/status
```
