// /balance — budget usage for the current month.
const { client, ledgerUserId } = require("../services/expense.service");
const { monthRange } = require("../../server/src/services/expense.service");

module.exports = async function balance(message, { sendMessage }) {
  const supabase = client();
  const user_id = await ledgerUserId();
  const { start, end } = monthRange(new Date());

  const [budgets, spent] = await Promise.all([
    supabase.from("budgets").select("*").eq("user_id", user_id),
    supabase
      .from("transactions")
      .select("amount, category")
      .eq("type", "expense")
      .eq("user_id", user_id)
      .gte("expense_date", start)
      .lte("expense_date", end),
  ]);
  if (budgets.error) throw new Error(budgets.error.message);
  if (spent.error) throw new Error(spent.error.message);

  const byCategory = {};
  for (const e of spent.data || []) {
    byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount);
  }

  const lines = (budgets.data || []).map((b) => {
    const used = byCategory[b.category] || 0;
    const pct = Math.round((used / b.monthly_limit) * 100);
    const mark = used > b.monthly_limit ? "🚨" : pct >= 80 ? "⚠️" : "•";
    return `${mark} <b>${b.category}</b>: ₹${used} of ₹${b.monthly_limit} (${pct}%)`;
  });

  const totalBudget = (budgets.data || []).reduce((s, b) => s + Number(b.monthly_limit), 0);
  const totalSpent = Object.values(byCategory).reduce((s, n) => s + n, 0);

  await sendMessage(
    message.chat.id,
    [
      "<b>This month</b>",
      `Spent: ₹${totalSpent}` + (totalBudget ? ` of ₹${totalBudget} budgeted` : ""),
      "",
      ...(lines.length ? lines : ["No budgets set — use the dashboard or /budget."]),
    ].join("\n")
  );
};
