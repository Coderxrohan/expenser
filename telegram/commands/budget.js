// /budget — budgets & progress (with inline buttons to set new limits).
const { client, ledgerUserId } = require("../services/expense.service");
const { monthRange } = require("../../server/src/services/expense.service");
const { CATEGORIES } = require("../../server/src/utils/validation");

module.exports = async function budget(message, { sendMessage }) {
  const supabase = client();
  const user_id = await ledgerUserId();
  const { start, end } = monthRange(new Date());

  const [budgets, spent] = await Promise.all([
    supabase.from("budgets").select("*").eq("user_id", user_id).order("category"),
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
  for (const e of spent.data || []) byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount);

  const lines = (budgets.data || []).map((b) => {
    const used = byCategory[b.category] || 0;
    const pct = Math.min(100, Math.round((used / b.monthly_limit) * 100));
    const bar = "█".repeat(Math.round(pct / 10)).padEnd(10, "░");
    const mark = used > b.monthly_limit ? " 🚨over" : "";
    return `<b>${b.category}</b>\n${bar} ${pct}% — ₹${used} / ₹${b.monthly_limit}${mark}`;
  });

  await sendMessage(
    message.chat.id,
    ["<b>Budgets</b>", "", ...(lines.length ? lines : ["No budgets yet."])].join("\n"),
    {
      reply_markup: {
        inline_keyboard: CATEGORIES.slice(0, 8).map((c) => [
          { text: `Set ${c}`, callback_data: `budget:${c}` },
        ]),
      },
    }
  );
};
