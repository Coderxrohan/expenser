// ============================================================
// Telegram — callback handler (inline buttons)
// budget:<category> → prompt for an amount
// receipt:confirm / receipt:cancel → resolve an OCR draft
// ============================================================
const { client, ledgerUserId } = require("../services/expense.service");
const photoHandler = require("./photo.handler");

const pendingAmounts = new Map(); // chatId → category awaiting an amount

async function handle(callbackQuery, { sendMessage }) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data || "";
  const answer = () =>
    fetch(`https://api.telegram.org/bot${require("../../server/src/config/env").telegramBotToken}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id }),
    });

  try {
    if (data === "receipt:confirm") {
      await photoHandler.confirmDraft(sendMessage, chatId);
    } else if (data === "receipt:cancel") {
      await photoHandler.cancelDraft(sendMessage, chatId);
    } else if (data.startsWith("budget:")) {
      const category = data.slice("budget:".length);
      pendingAmounts.set(chatId, category);
      await sendMessage(chatId, `Send the monthly limit for <b>${category}</b> (e.g. "4000").`);
    }
    await answer();
  } catch (e) {
    await answer();
    await sendMessage(chatId, `⚠️ ${e.message}`);
  }
}

// Called from the message handler when a bare number arrives while
// a budget amount is pending.
async function maybePendingBudget(chatId, text, sendMessage) {
  const category = pendingAmounts.get(chatId);
  if (!category) return false;
  const amount = Number(text.replace(/[₹,\s]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return false;

  const user_id = await ledgerUserId();
  const { error } = await client()
    .from("budgets")
    .upsert({ user_id, category, monthly_limit: amount }, { onConflict: "user_id,category" });
  if (error) throw new Error(error.message);

  pendingAmounts.delete(chatId);
  await sendMessage(chatId, `✅ Budget set: <b>${category}</b> at ₹${amount}/month.`);
  return true;
}

module.exports = { handle, maybePendingBudget };
