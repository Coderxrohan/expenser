// /recent — last 10 expenses.
const { client, userIdForChat } = require("../services/expense.service");

module.exports = async function recent(message, { sendMessage }) {
  const supabase = client();
  const user_id = await userIdForChat(chatId);

  const { data, error } = await supabase
    .from("transactions")
    .select("amount, category, name, note, expense_date")
      .eq("type", "expense")
    .eq("user_id", user_id)
    .order("expense_date", { ascending: false })
    .limit(10);
  if (error) throw new Error(error.message);

  const lines = (data || []).map(
    (e) => `• ${e.expense_date} — <b>${e.name || e.note || e.category}</b> (${e.category}): ₹${e.amount}`
  );

  await sendMessage(
    message.chat.id,
    ["<b>Recent expenses</b>", "", ...(lines.length ? lines : ["Nothing logged yet."])].join("\n")
  );
};
