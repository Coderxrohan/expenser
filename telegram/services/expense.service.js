// ============================================================
// Ledger — telegram expense service
// Bridge between bot commands and the Supabase-backed data.
// Multi-user: each Telegram chat is mapped to a Ledger account
// via public.telegram_links (linked from the website panel).
// LEDGER_OWNER_EMAIL remains as a fallback for an unlinked chat.
// Runs server-side with the service-role key — never exposed.
// ============================================================
const { createClient } = require("@supabase/supabase-js");
const env = require("../../server/src/config/env");

let clientCache = null;
let userIdCache = null; // owner-email fallback
const chatUserCache = new Map(); // chat_id -> user_id

function client() {
  if (!env.supabaseServiceKey) {
    throw new Error("The Telegram bot needs SUPABASE_SERVICE_ROLE_KEY in .env (server-side automation).");
  }
  if (!clientCache) {
    clientCache = createClient(env.supabaseUrl, env.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return clientCache;
}

function normalizeChatId(v) {
  return String(v ?? "").replace(/\D/g, "");
}

// Resolve the ledger owner's user id once from their email (fallback mode).
async function ledgerUserId() {
  if (userIdCache) return userIdCache;
  const email = env.ledgerOwnerEmail;
  if (!email) {
    throw new Error("Set LEDGER_OWNER_EMAIL in .env to link the bot with your Ledger account.");
  }
  const { data, error } = await client().auth.admin.listUsers({ perPage: 200 });
  if (error) throw new Error(error.message);
  const user = (data.users || []).find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) throw new Error(`No Ledger account found for ${email}. Sign up in the app first.`);
  userIdCache = user.id;
  return userIdCache;
}

// Resolve the account a chat belongs to: telegram_links first,
// then the LEDGER_OWNER_EMAIL fallback. Cached per chat.
async function userIdForChat(chatId) {
  const chat = normalizeChatId(chatId);
  if (!chat) throw new Error("Unknown chat.");

  if (chatUserCache.has(chat)) return chatUserCache.get(chat);

  const { data, error } = await client()
    .from("telegram_links")
    .select("user_id")
    .eq("chat_id", chat)
    .maybeSingle();
  if (error) throw new Error(error.message);

  let userId = data?.user_id || null;
  if (!userId) userId = await userIdForChat(chatId); // fallback: single-owner setup
  chatUserCache.set(chat, userId);
  return userId;
}

// A chat may talk to the bot if it is linked in telegram_links,
// or if it matches TELEGRAM_CHAT_ID (owner fallback).
async function isChatAllowed(chatId) {
  const chat = normalizeChatId(chatId);
  if (!chat) return false;
  if (env.telegramChatId && chat === normalizeChatId(env.telegramChatId)) return true;
  try {
    const { data } = await client()
      .from("telegram_links")
      .select("user_id")
      .eq("chat_id", chat)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

module.exports = { client, ledgerUserId, userIdForChat, isChatAllowed };
