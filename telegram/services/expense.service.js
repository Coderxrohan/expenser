// ============================================================
// Ledger — telegram expense service
// Bridge between bot commands and the Supabase-backed data.
// The bot is single-user by design: it acts as the Ledger owner,
// identified by LEDGER_OWNER_EMAIL in .env (server-side, using
// the service-role key — never exposed to the client).
// ============================================================
const { createClient } = require("@supabase/supabase-js");
const env = require("../../server/src/config/env");

let clientCache = null;
let userIdCache = null;

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

// Resolve the ledger owner's user id once from their email.
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

module.exports = { client, ledgerUserId };
