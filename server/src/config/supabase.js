// ============================================================
// Ledger — Supabase clients
// anon client: honors the caller's JWT (RLS applies)
// admin client: service role, used only for storage + audit logs
// ============================================================
const { createClient } = require("@supabase/supabase-js");
const env = require("./env");

const opts = { auth: { persistSession: false, autoRefreshToken: false } };

const supabase = env.supabaseUrl && env.supabaseAnonKey
  ? createClient(env.supabaseUrl, env.supabaseAnonKey, opts)
  : null;

const admin = env.supabaseServiceKey
  ? createClient(env.supabaseUrl, env.supabaseServiceKey, opts)
  : null;

module.exports = { supabase, admin };
