// /recent — last 10 expenses.
const { client, ledgerUserId } = require("../services/expense.service");

module.exports = async function recent(message, { sendMessage }) {
  const supabase = client();
  const user_id = await ledgerUserId();

  const { data, error } = await supabase
    .from("transactions")
    .select("amount, category, note, expense_date")
      .eq("type", "expense")
    .eq("user_id", user_id)
    .order("expense_date", { ascending: false })
    .limit(10);
  if (error) throw new Error(error.message);

  const lines = (data || []).map(
    (e) => `• ${e.expense_date} — <b>${e.category}</b>${e.note ? ` (${e.note})` : ""}: ₹${e.amount}`
  );

  await sendMessage(
    message.chat.id,
    ["<b>Recent expenses</b>", "", ...(lines.length ? lines : ["Nothing logged yet."])].join("\n")
  );
};
