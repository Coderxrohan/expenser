// ============================================================
// Ledger — report service
// Builds data packs for the PDF/CSV exports in /reports and the
// API's report endpoints.
// ============================================================
const { createClient } = require("@supabase/supabase-js");
const env = require("../config/env");

function clientFor(token) {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

async function fetchExpenses(token, { from, to } = {}) {
  let query = clientFor(token)
    .from("expenses")
    .select("*")
    .order("expense_date", { ascending: true });
  if (from) query = query.gte("expense_date", from);
  if (to) query = query.lte("expense_date", to);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

// Everything a report needs: rows + totals + category breakdown.
async function reportPack(token, { from, to } = {}) {
  const rows = await fetchExpenses(token, { from, to });
  const total = rows.reduce((s, e) => s + Number(e.amount), 0);
  const byCategory = {};
  const byMethod = {};
  for (const e of rows) {
    byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount);
    byMethod[e.payment_method || "cash"] = (byMethod[e.payment_method || "cash"] || 0) + Number(e.amount);
  }
  return {
    from: from || null,
    to: to || null,
    generatedAt: new Date().toISOString(),
    rowCount: rows.length,
    total: Math.round(total * 100) / 100,
    byCategory: Object.entries(byCategory)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
    byPaymentMethod: Object.entries(byMethod)
      .map(([method, amount]) => ({ method, amount }))
      .sort((a, b) => b.amount - a.amount),
    rows,
  };
}

// ---- backup / restore ------------------------------------------

async function exportBackup(token) {
  const db = clientFor(token);
  const [expenses, budgets] = await Promise.all([
    db.from("expenses").select("*"),
    db.from("budgets").select("*"),
  ]);
  if (expenses.error) throw new Error(expenses.error.message);
  if (budgets.error) throw new Error(budgets.error.message);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    expenses: expenses.data || [],
    budgets: budgets.data || [],
  };
}

async function importBackup(token, userId, backup) {
  if (!backup || !Array.isArray(backup.expenses)) {
    const { ApiError } = require("../middleware/error");
    throw new ApiError(400, 'Backup JSON must have an "expenses" array.');
  }
  const db = clientFor(token);
  const rows = backup.expenses.map((e) => ({
    user_id: userId,
    amount: Number(e.amount),
    category: e.category || "Other",
    note: e.note || null,
    expense_date: e.expense_date || e.date,
    payment_method: e.payment_method || "cash",
    currency: e.currency || "INR",
  }));
  const { error } = await db.from("expenses").insert(rows);
  if (error) throw new Error(error.message);
  return { imported: rows.length };
}

module.exports = { fetchExpenses, reportPack, exportBackup, importBackup };
