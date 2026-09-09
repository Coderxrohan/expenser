// ============================================================
// Ledger — telegram notification service
// Access control for chats + proactive pushes (budget warnings,
// monthly summaries, recurring reminders).
// ============================================================
const env = require("../../server/src/config/env");
const logger = require("../../server/src/utils/logger");

function allowedChat(_env, chatId) {
  // Single-user bot: only the configured chat may talk to it.
  if (!env.telegramChatId) return false;
  return String(chatId) === String(env.telegramChatId);
}

async function push(text, extra = {}) {
  if (!env.telegramBotToken || !env.telegramChatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.telegramBotToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: env.telegramChatId, text, parse_mode: "HTML", ...extra }),
    });
    return res.ok;
  } catch (e) {
    logger.warn("telegram push failed:", e.message);
    return false;
  }
}

async function budgetWarning(status) {
  const hot = status.filter((b) => b.warning === "exceeded" || b.warning === "near-limit");
  if (!hot.length) return;
  const lines = hot.map((b) =>
    b.warning === "exceeded"
      ? `🚨 <b>${b.category}</b> over budget: ₹${b.spent} / ₹${b.monthly_limit}`
      : `⚠️ <b>${b.category}</b> at ${b.percent}% of budget: ₹${b.spent} / ₹${b.monthly_limit}`
  );
  await push(`<b>Budget alert</b>\n${lines.join("\n")}`);
}

async function monthlySummary(summary) {
  const lines = [
    "<b>Monthly summary</b>",
    `Spent: ₹${summary.monthTotal}`,
    summary.lastTotal ? `vs last month: ₹${summary.lastTotal}` : null,
    `Transactions: ${summary.transactionCount}`,
    `Daily average: ₹${summary.dailyAverage}`,
  ].filter(Boolean);
  await push(lines.join("\n"));
}

async function expenseConfirmation(expense) {
  await push(
    `✅ Added ₹${expense.amount} — <b>${expense.category}</b>${expense.note ? ` (${expense.note})` : ""} on ${expense.expense_date}`
  );
}

async function recurringReminder(templates) {
  if (!templates.length) return;
  const lines = templates.map((t) => `🔁 ${t.label}: ₹${t.amount} due ${t.next_due_date}`);
  await push(`<b>Recurring expenses due</b>\n${lines.join("\n")}`);
}

module.exports = { allowedChat, push, budgetWarning, monthlySummary, expenseConfirmation, recurringReminder };
