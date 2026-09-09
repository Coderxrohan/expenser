// ============================================================
// Ledger — income service
// Mirrors expense.service; queries run with the caller's token
// so RLS applies.
// ============================================================
const { createClient } = require("@supabase/supabase-js");
const env = require("../config/env");

function clientFor(token) {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

// Income rows live in the merged `transactions` table (type = 'income');
// the date column is `expense_date` there. The API keeps speaking
// `income_date` to clients — mapped here in both directions.
function toApi(row) {
  if (!row) return row;
  return { ...row, income_date: row.expense_date };
}

function toDb(payload) {
  const { income_date, ...rest } = payload;
  return { ...rest, ...(income_date ? { expense_date: income_date } : {}) };
}

async function listIncomes(token, { from, to, category, search, limit = 500 } = {}) {
  let query = clientFor(token)
    .from("transactions")
    .select("*")
    .eq("type", "income")
    .order("expense_date", { ascending: false })
    .limit(limit);

  if (from) query = query.gte("expense_date", from);
  if (to) query = query.lte("expense_date", to);
  if (category) query = query.eq("category", category);
  if (search) query = query.ilike("note", `%${search}%`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []).map(toApi);
}

async function getIncome(token, id) {
  const { data, error } = await clientFor(token)
    .from("transactions")
    .select("*")
    .eq("type", "income")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return toApi(data);
}

async function createIncome(token, payload) {
  const { data, error } = await clientFor(token)
    .from("transactions")
    .insert({ ...toDb(payload), type: "income" })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function updateIncome(token, id, payload) {
  const { data, error } = await clientFor(token)
    .from("transactions")
    .update(toDb(payload))
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return toApi(data);
}

async function deleteIncome(token, id) {
  const { error } = await clientFor(token).from("transactions").delete().eq("type", "income").eq("id", id);
  if (error) throw new Error(error.message);
}

module.exports = {
  listIncomes,
  getIncome,
  createIncome,
  updateIncome,
  deleteIncome,
};
