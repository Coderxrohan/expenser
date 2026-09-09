// /start — link this chat and show help.
module.exports = async function start(message, { sendMessage }) {
  await sendMessage(
    message.chat.id,
    [
      "<b>Ledger bot</b> — your expense ledger in chat.",
      "",
      "<b>Commands</b>",
      "/add 500 food — log an expense (amount + category [+ note])",
      "/balance — budget usage this month",
      "/today — today's spending",
      "/month — this month's summary",
      "/budget — budgets & progress",
      "/recent — last 10 expenses",
      "",
      "📷 Send a receipt photo and I'll read it with OCR and create the expense.",
    ].join("\n")
  );
};
