// ============================================================
// Telegram — message handler (text commands + free-form entries)
// ============================================================
const logger = require("../../server/src/utils/logger");
const ocr = require("../../ocr/ocr.service");
const callbackHandler = require("./callback.handler");

const COMMAND_RE = /^\/([a-z]+)/i;

// Free-form entry: "500 food lunch" — same shape as /add without the slash.
async function freeFormEntry(text, { sendMessage, commands }, message) {
  message.text = "/add " + text;
  return commands.add(message, { sendMessage });
}

async function handle(message, { sendMessage, commands }) {
  const chatId = message.chat.id;
  const text = (message.text || "").trim();

  const m = text.match(COMMAND_RE);
  if (m) {
    const cmd = m[1].toLowerCase();
    const fn = commands[cmd];
    if (!fn) {
      return sendMessage(chatId, `Unknown command /${cmd}. Try /start for help.`);
    }
    try {
      return await fn(message, { sendMessage });
    } catch (e) {
      logger.error(`/${cmd} failed:`, e.message);
      return sendMessage(chatId, `⚠️ ${e.message}`);
    }
  }

  // a budget amount is pending for an inline button → treat as the limit
  if (/^\d+([\d,.]+)?$/.test(text) && (await callbackHandler.maybePendingBudget(chatId, text, sendMessage))) {
    return;
  }

  // not a command — try "500 food" style entry
  if (/^\d/.test(text)) {
    try {
      return await freeFormEntry(text, { sendMessage, commands }, message);
    } catch (e) {
      logger.error("free-form entry failed:", e.message);
      return sendMessage(chatId, `⚠️ ${e.message}`);
    }
  }

  return sendMessage(chatId, "Send /start to see what I can do.");
}

module.exports = { handle };
