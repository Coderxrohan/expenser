// ============================================================
// Ledger — telegram link service
// Maps Telegram chat_ids to Ledger accounts so the shared bot
// acts as the right user. Queries run with the caller's token
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

// Telegram chat ids are integers; keep digits only so
// "+123", "123 " and "123" all link the same chat.
function normalizeChatId(v) {
  return String(v ?? "").replace(/\D/g, "") || null;
}

async function listLinks(token) {
  const { data, error } = await clientFor(token)
    .from("telegram_links")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

async function createLink(token, { chat_id, label, user_id }) {
  const chatId = normalizeChatId(chat_id);
  if (!chatId) {
    const { ApiError } = require("../middleware/error");
    throw new ApiError(400, "chat_id is required (digits only).");
  }
  if (!user_id) {
    const { ApiError } = require("../middleware/error");
    throw new ApiError(401, "Not signed in.");
  }
  const { data, error } = await clientFor(token)
    .from("telegram_links")
    .insert({ chat_id: chatId, label: label || null, user_id })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") {
      const { ApiError } = require("../middleware/error");
      throw new ApiError(409, "That chat id is already linked to an account.");
    }
    throw new Error(error.message);
  }
  return data;
}

async function updateLink(token, id, { label }) {
  const { data, error } = await clientFor(token)
    .from("telegram_links")
    .update({ label: label || null })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function deleteLink(token, id) {
  const { error } = await clientFor(token)
    .from("telegram_links")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

module.exports = { listLinks, createLink, updateLink, deleteLink, normalizeChatId };
