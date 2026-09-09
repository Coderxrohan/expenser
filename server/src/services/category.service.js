// ============================================================
// Ledger — category service
// Per-user category names for expenses and income. On first
// fetch the built-in defaults are seeded, so every category the
// user sees is a real, editable row.
// ============================================================
const { createClient } = require("@supabase/supabase-js");
const env = require("../config/env");

const DEFAULT_EXPENSE = [
  "Food", "Transport", "Shopping", "Bills",
  "Entertainment", "Health", "Education", "Other",
];
const DEFAULT_INCOME = ["Salary", "Freelance", "Business", "Investment", "Gift", "Other"];

function clientFor(token) {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

function cleanName(v) {
  const name = String(v ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
  if (!name) {
    const { ApiError } = require("../middleware/error");
    throw new ApiError(400, "Category name is required.");
  }
  return name;
}

// Seed the defaults the first time a user loads the settings page.
async function ensureSeeded(db, userId) {
  const { data } = await db.from("categories").select("id").limit(1);
  if (data && data.length) return;

  const rows = [
    ...DEFAULT_EXPENSE.map((name) => ({ user_id: userId, type: "expense", name })),
    ...DEFAULT_INCOME.map((name) => ({ user_id: userId, type: "income", name })),
  ];
  await db.from("categories").insert(rows).suppressNotFound?.();
  const seeded = await db.from("categories").select("*").limit(1);
  if (seeded.error) throw new Error(seeded.error.message);
}

async function listCategories(token, userId) {
  const db = clientFor(token);
  await ensureSeeded(db, userId);
  const { data, error } = await db
    .from("categories")
    .select("*")
    .order("type")
    .order("created_at");
  if (error) throw new Error(error.message);
  return data || [];
}

async function createCategory(token, userId, { type, name }) {
  if (!["expense", "income"].includes(type)) {
    const { ApiError } = require("../middleware/error");
    throw new ApiError(400, 'type must be "expense" or "income".');
  }
  const clean = cleanName(name);
  const { data, error } = await clientFor(token)
    .from("categories")
    .insert({ user_id: userId, type, name: clean })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") {
      const { ApiError } = require("../middleware/error");
      throw new ApiError(409, `"${clean}" already exists.`);
    }
    throw new Error(error.message);
  }
  return data;
}

async function updateCategory(token, userId, id, { name }) {
  const clean = cleanName(name);
  const { data, error } = await clientFor(token)
    .from("categories")
    .update({ name: clean })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();
  if (error) {
    if (error.code === "23505") {
      const { ApiError } = require("../middleware/error");
      throw new ApiError(409, `"${clean}" already exists.`);
    }
    throw new Error(error.message);
  }
  return data;
}

// Wipe the user's categories of one type and restore the built-ins.
async function resetCategories(token, userId, type) {
  if (!["expense", "income"].includes(type)) {
    const { ApiError } = require("../middleware/error");
    throw new ApiError(400, 'type must be "expense" or "income".');
  }
  const defaults = type === "expense" ? DEFAULT_EXPENSE : DEFAULT_INCOME;
  const db = clientFor(token);
  const del = await db.from("categories").delete().eq("user_id", userId).eq("type", type);
  if (del.error) throw new Error(del.error.message);
  const rows = defaults.map((name) => ({ user_id: userId, type, name }));
  const ins = await db.from("categories").insert(rows);
  if (ins.error) throw new Error(ins.error.message);
  const { data, error } = await db
    .from("categories")
    .select("*")
    .eq("type", type)
    .order("created_at");
  if (error) throw new Error(error.message);
  return data || [];
}

async function deleteCategory(token, userId, id) {
  const { error } = await clientFor(token)
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  resetCategories,
  DEFAULT_EXPENSE,
  DEFAULT_INCOME,
};
