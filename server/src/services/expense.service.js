// ============================================================
// Ledger — expense service
// All queries run with the caller's token so RLS applies.
// ============================================================
const { createClient } = require("@supabase/supabase-js");
const env = require("../config/env");

// One client per request, carrying the caller's JWT so RLS applies.
function clientFor(token) {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

async function listExpenses(token, { from, to, category, search, limit = 500 } = {}) {
  let query = clientFor(token)
    .from("transactions")
    .select("*")
    .eq("type", "expense")
    .order("expense_date", { ascending: false })
    .limit(limit);

  if (from) query = query.gte("expense_date", from);
  if (to) query = query.lte("expense_date", to);
  if (category) query = query.eq("category", category);
  if (search) query = query.ilike("note", `%${search}%`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

async function getExpense(token, id) {
  const { data, error } = await clientFor(token)
    .from("transactions")
    .select("*")
    .eq("type", "expense")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function createExpense(token, payload) {
  const { data, error } = await clientFor(token)
    .from("transactions")
    .insert({ ...payload, type: "expense" })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function updateExpense(token, id, payload) {
  const { data, error } = await clientFor(token)
    .from("transactions")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function deleteExpense(token, id) {
  const { error } = await clientFor(token).from("transactions").delete().eq("type", "expense").eq("id", id);
  if (error) throw new Error(error.message);
}

// ---- analytics -------------------------------------------------

function sumBy(rows, keyFn) {
  const acc = {};
  for (const r of rows) {
    const key = keyFn(r);
    acc[key] = (acc[key] || 0) + Number(r.amount);
  }
  return acc;
}

function monthRange(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

async function analytics(token, now = new Date()) {
  const all = await listExpenses(token, { limit: 5000 });
  const { start, end } = monthRange(now);
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const { start: pStart, end: pEnd } = monthRange(prev);

  const thisMonth = all.filter((e) => e.expense_date >= start && e.expense_date <= end);
  const lastMonth = all.filter((e) => e.expense_date >= pStart && e.expense_date <= pEnd);

  const monthTotal = thisMonth.reduce((s, e) => s + Number(e.amount), 0);
  const lastTotal = lastMonth.reduce((s, e) => s + Number(e.amount), 0);
  const dayOfMonth = now.getDate();

  // daily spending for the current month
  const daily = sumBy(thisMonth, (e) => e.expense_date);
  const dailySeries = Object.entries(daily)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, amount]) => ({ date, amount }));

  const byCategory = Object.entries(sumBy(thisMonth, (e) => e.category))
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  // month-over-month per category
  const thisCat = sumBy(thisMonth, (e) => e.category);
  const lastCat = sumBy(lastMonth, (e) => e.category);

  // top merchants from notes
  const byMerchant = sumBy(
    thisMonth.filter((e) => e.note),
    (e) => e.note
  );
  const topMerchants = Object.entries(byMerchant)
    .map(([merchant, amount]) => ({ merchant, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  return {
    month: start.slice(0, 7),
    monthTotal,
    lastMonthTotal: lastTotal,
    monthOverMonth: lastTotal
      ? Math.round(((monthTotal - lastTotal) / lastTotal) * 1000) / 10
      : null,
    dailyAverage: dayOfMonth ? Math.round((monthTotal / dayOfMonth) * 100) / 100 : 0,
    transactionCount: thisMonth.length,
    dailySeries,
    byCategory,
    categoryComparison: Object.keys({ ...thisCat, ...lastCat }).map((cat) => ({
      category: cat,
      thisMonth: thisCat[cat] || 0,
      lastMonth: lastCat[cat] || 0,
    })),
    topMerchants,
    averagePerTransaction: thisMonth.length
      ? Math.round((monthTotal / thisMonth.length) * 100) / 100
      : 0,
  };
}

module.exports = {
  listExpenses,
  getExpense,
  createExpense,
  updateExpense,
  deleteExpense,
  analytics,
  monthRange,
};
