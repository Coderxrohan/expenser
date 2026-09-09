// ============================================================
// Ledger — budget service
// ============================================================
const { createClient } = require("@supabase/supabase-js");
const env = require("../config/env");
const { monthRange } = require("./expense.service");

function clientFor(token) {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

async function listBudgets(token) {
  const { data, error } = await clientFor(token)
    .from("budgets")
    .select("*")
    .order("category");
  if (error) throw new Error(error.message);
  return data || [];
}

async function upsertBudget(token, { category, monthly_limit }) {
  const { data, error } = await clientFor(token)
    .from("budgets")
    .upsert(
      { category, monthly_limit },
      { onConflict: "user_id,category" }
    )
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function deleteBudget(token, id) {
  const { error } = await clientFor(token).from("budgets").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// Budget status with spent amounts + warnings at 80% and 100%.
async function budgetStatus(token, now = new Date()) {
  const [budgets, expenses] = await Promise.all([
    listBudgets(token),
    (async () => {
      const { start, end } = monthRange(now);
      const { data, error } = await clientFor(token)
        .from("expenses")
        .select("amount, category, expense_date")
        .gte("expense_date", start)
        .lte("expense_date", end);
      if (error) throw new Error(error.message);
      return data || [];
    })(),
  ]);

  const spentByCategory = {};
  for (const e of expenses) {
    spentByCategory[e.category] = (spentByCategory[e.category] || 0) + Number(e.amount);
  }

  return budgets.map((b) => {
    const spent = Math.round((spentByCategory[b.category] || 0) * 100) / 100;
    const pct = b.monthly_limit > 0 ? (spent / b.monthly_limit) * 100 : 0;
    const warning =
      spent > b.monthly_limit ? "exceeded" : pct >= 80 ? "near-limit" : "ok";
    return {
      id: b.id,
      category: b.category,
      monthly_limit: Number(b.monthly_limit),
      spent,
      percent: Math.round(pct * 10) / 10,
      warning,
      remaining: Math.round((Number(b.monthly_limit) - spent) * 100) / 100,
    };
  });
}

module.exports = { listBudgets, upsertBudget, deleteBudget, budgetStatus };
