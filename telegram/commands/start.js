// /start — show help + this chat's id (used to link on the website).
module.exports = async function start(message, { sendMessage }) {
  const chatId = message.chat.id;
  await sendMessage(
    chatId,
    [
      "<b>Ledger bot</b> — your expense ledger in chat.",
      "",
      `This chat's ID: <code>${chatId}</code>`,
      "Link it on the website (Dashboard → Telegram bot) so I log expenses as your account.",
      "",
      "<b>Commands</b>",
      "/add 500 food lunch — log an expense (amount + category + name)",
      "/today — today's spending",
      "/month — this month's summary",
      "/recent — last 10 expenses",
      "",
      "📷 Send a receipt photo and I'll read it with OCR and create the expense.",
    ].join("\n")
  );
};
