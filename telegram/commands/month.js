// /month — this month's summary.
const { client, ledgerUserId } = require("../services/expense.service");
const { monthRange } = require("../../server/src/services/expense.service");

module.exports = async function month(message, { sendMessage }) {
  const supabase = client();
  const user_id = await ledgerUserId();
  const now = new Date();
  const { start, end } = monthRange(now);
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const { start: pStart, end: pEnd } = monthRange(prev);

  const [thisRes, lastRes] = await Promise.all([
    supabase
      .from("expenses")
      .select("amount, category")
      .eq("user_id", user_id)
      .gte("expense_date", start)
      .lte("expense_date", end),
    supabase
      .from("expenses")
      .select("amount")
      .eq("user_id", user_id)
      .gte("expense_date", pStart)
      .lte("expense_date", pEnd),
  ]);
  if (thisRes.error) throw new Error(thisRes.error.message);
  if (lastRes.error) throw new Error(lastRes.error.message);

  const rows = thisRes.data || [];
  const total = rows.reduce((s, e) => s + Number(e.amount), 0);
  const lastTotal = (lastRes.data || []).reduce((s, e) => s + Number(e.amount), 0);

  const byCategory = {};
  for (const e of rows) byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount);
  const top = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const dailyAvg = now.getDate() ? Math.round(total / now.getDate()) : 0;
  const mom = lastTotal ? `${Math.round(((total - lastTotal) / lastTotal) * 100)}% vs last month` : "no data for last month";

  await sendMessage(
    message.chat.id,
    [
      `<b>${start.slice(0, 7)} summary</b>`,
      `Spent: ₹${total} (${mom})`,
      `Daily average: ₹${dailyAvg}`,
      `Transactions: ${rows.length}`,
      "",
      ...top.map(([cat, amt]) => `• ${cat}: ₹${amt}`),
    ].join("\n")
  );
};
