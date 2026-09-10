// /today — today's spending.
const { client, userIdForChat } = require("../services/expense.service");

const { localISO } = require("../../server/src/utils/validation");
module.exports = async function today(message, { sendMessage }) {
  const supabase = client();
  const user_id = await userIdForChat(chatId);
  const day = localISO();

  const { data, error } = await supabase
    .from("transactions")
    .select("amount, category, name, note")
      .eq("type", "expense")
    .eq("user_id", user_id)
    .eq("expense_date", day)
    .order("created_at");
  if (error) throw new Error(error.message);

  const total = (data || []).reduce((s, e) => s + Number(e.amount), 0);
  const lines = (data || []).map((e) => `• ${e.category}${e.name || e.note ? ` — ${e.name || e.note}` : ""}: ₹${e.amount}`);

  await sendMessage(
    message.chat.id,
    [`<b>Today (${day})</b>`, `Spent: ₹${total}`, "", ...(lines.length ? lines : ["Nothing logged today."])].join("\n")
  );
};
