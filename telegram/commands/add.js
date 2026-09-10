// /add 500 food lunch with team — create an expense (name is required).
const { client, userIdForChat } = require("../services/expense.service");
const notification = require("../services/notification.service");
const { CATEGORIES, parseAmount, parseDate, localISO } = require("../../server/src/utils/validation");

function findCategory(word) {
  const w = word.toLowerCase();
  return CATEGORIES.find((c) => c.toLowerCase().startsWith(w)) || null;
}

module.exports = async function add(message, { sendMessage }) {
  const chatId = message.chat.id;
  const parts = message.text.split(/\s+/).slice(1); // drop "/add"
  if (parts.length < 3) {
    return sendMessage(chatId, "Usage: <code>/add 500 food lunch with team</code> — a name is required after the category.");
  }

  const [amountRaw, catRaw, ...nameParts] = parts;
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

  const name = nameParts.join(" ").replace(/\s+/g, " ").trim().slice(0, 120);
  const user_id = await userIdForChat(chatId);

  const { data, error } = await client()
    .from("transactions")
    .insert({ user_id, amount, category, name, type: "expense", expense_date: parseDate(localISO()) })
    .select()
    .single();
  if (error) throw new Error(error.message);

  await sendMessage(chatId, `✅ Added ₹${amount} — <b>${name}</b> (${category})`);
};
