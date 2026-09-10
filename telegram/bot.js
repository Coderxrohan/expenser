// ============================================================
// Ledger — Telegram bot
// Zero-dependency bot client using the raw Telegram Bot API over
// fetch. Runs in webhook mode when mounted on the Express app,
// or standalone long-polling via `node telegram/bot.js`.
//
// Setup: in Telegram, chat with @BotFather → /newbot → paste the
// token into TELEGRAM_BOT_TOKEN in .env. To link a user, add
// TELEGRAM_CHAT_ID=your-chat-id to .env (get it via /start).
// ============================================================
const env = require("../server/src/config/env");
const logger = require("../server/src/utils/logger");
const expenseService = require("./services/expense.service");
const notification = require("./services/notification.service");
const messageHandler = require("./handlers/message.handler");
const photoHandler = require("./handlers/photo.handler");
const callbackHandler = require("./handlers/callback.handler");

const API = () => `https://api.telegram.org/bot${env.telegramBotToken}`;

const commands = {
  start: require("./commands/start"),
  add: require("./commands/add"),
  balance: require("./commands/balance"),
  today: require("./commands/today"),
  month: require("./commands/month"),
  budget: require("./commands/budget"),
  recent: require("./commands/recent"),
};

// ---- low-level send helpers ------------------------------------

async function callApi(method, payload) {
  const res = await fetch(`${API()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.ok) logger.warn(`Telegram ${method} failed:`, data.description);
  return data.result;
}

function sendMessage(chatId, text, extra = {}) {
  return callApi("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    ...extra,
  });
}

// ---- update dispatch -------------------------------------------

async function handleUpdate(update) {
  const chatId = update.message?.chat?.id ?? update.callback_query?.message?.chat?.id;
  if (!chatId) return;

  const allowed = await require('./services/expense.service').isChatAllowed(chatId);
  if (!allowed) {
    return sendMessage(
      chatId,
      "This bot is private. Set your chat id as TELEGRAM_CHAT_ID in the Ledger .env, then try /start again."
    );
  }

  if (update.callback_query) {
    return callbackHandler.handle(update.callback_query, { sendMessage });
  }

  const message = update.message;
  if (message.photo || message.document?.mime_type?.startsWith("image/")) {
    return photoHandler.handle(message, { sendMessage });
  }
  if (message.text) {
    return messageHandler.handle(message, { sendMessage, commands });
  }
}

// ---- webhook / polling -----------------------------------------

function mountTelegram(app) {
  if (!env.telegramBotToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set — bot disabled.");
  }
  app.post(`/telegram/${env.telegramWebhookSecret || "webhook"}`, (req, res) => {
    handleUpdate(req.body).catch((e) => logger.error("telegram update failed:", e));
    res.json({ ok: true }); // ack fast; processing continues
  });
  logger.info("Telegram webhook mounted.");
}

async function startPolling() {
  if (!env.telegramBotToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set in .env");
  }
  let offset = 0;
  logger.info("Telegram bot polling started.");
  for (;;) {
    try {
      const updates = await callApi("getUpdates", { offset, timeout: 30 });
      for (const u of updates || []) {
        offset = u.update_id + 1;
        await handleUpdate(u).catch((e) => logger.error("telegram update failed:", e));
      }
    } catch (e) {
      logger.error("polling error:", e.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

// One-time: register the command menu in Telegram.
async function setCommands() {
  await callApi("setMyCommands", {
    commands: [
      { command: "start", description: "Link this chat & show help" },
      { command: "add", description: "/add 500 food [name] — log an expense" },
      { command: "balance", description: "Budget usage this month" },
      { command: "today", description: "Today's spending" },
      { command: "month", description: "This month's summary" },
      { command: "budget", description: "List budgets & progress" },
      { command: "recent", description: "Last 10 expenses" },
    ],
  });
}

if (require.main === module) {
  setCommands().catch((e) => logger.warn("setMyCommands failed:", e.message));
  startPolling().catch((e) => {
    logger.error(e.message);
    process.exit(1);
  });
}

module.exports = { mountTelegram, startPolling, handleUpdate, sendMessage };
