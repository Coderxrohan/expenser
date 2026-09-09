// /add 500 food [note…] — create an expense.
const { client, userIdForChat } = require("../services/expense.service");
const notification = require("../services/notification.service");
const { CATEGORIES, parseAmount, parseDate } = require("../../server/src/utils/validation");

function findCategory(word) {
  const w = word.toLowerCase();
  return CATEGORIES.find((c) => c.toLowerCase().startsWith(w)) || null;
}

module.exports = async function add(message, { sendMessage }) {
  const chatId = message.chat.id;
  const parts = message.text.split(/\s+/).slice(1); // drop "/add"
  if (parts.length < 2) {
    return sendMessage(chatId, "Usage: <code>/add 500 food lunch with team</code>");
  }

  const [amountRaw, catRaw, ...noteParts] = parts;
  const category = findCategory(catRaw);
  if (!category) {
    return sendMessage(chatId, `Unknown category "${catRaw}". Categories: ${CATEGORIES.join(", ")}`);
  }

  let amount;
  try {
    amount = parseAmount(amountRaw.replace(/[₹,]/g, ""));
  } catch {
    return sendMessage(chatId, `"${amountRaw}" doesn't look like a positive amount.`);
  }

  const note = noteParts.join(" ").slice(0, 200) || null;
  const user_id = await userIdForChat(chatId);

  const { data, error } = await client()
    .from("transactions")
    .insert({ user_id, amount, category, note, type: "expense", expense_date: parseDate(new Date().toISOString().slice(0, 10)) })
    .select()
    .single();
  if (error) throw new Error(error.message);

  await sendMessage(chatId, `✅ Added ₹${amount} — <b>${category}</b>${note ? ` (${note})` : ""}`);
};
