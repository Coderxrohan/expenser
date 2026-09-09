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

async function listIncomes(token, { from, to, category, search, limit = 500 } = {}) {
  let query = clientFor(token)
    .from("incomes")
    .select("*")
    .order("income_date", { ascending: false })
    .limit(limit);

  if (from) query = query.gte("income_date", from);
  if (to) query = query.lte("income_date", to);
  if (category) query = query.eq("category", category);
  if (search) query = query.ilike("note", `%${search}%`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

async function getIncome(token, id) {
  const { data, error } = await clientFor(token)
    .from("incomes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function createIncome(token, payload) {
  const { data, error } = await clientFor(token)
    .from("incomes")
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function updateIncome(token, id, payload) {
  const { data, error } = await clientFor(token)
    .from("incomes")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function deleteIncome(token, id) {
  const { error } = await clientFor(token).from("incomes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

module.exports = {
  listIncomes,
  getIncome,
  createIncome,
  updateIncome,
  deleteIncome,
};
