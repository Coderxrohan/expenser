// ============================================================
// Ledger — auth middleware
// Verifies the Supabase JWT from the Authorization header and
// attaches { id, email } to req.user. Downstream queries use
// req.token so RLS applies end-to-end.
// ============================================================
const { supabase } = require("../config/supabase");

module.exports = async function auth(req, res, next) {
  if (!supabase) {
    return res.status(503).json({ error: "SUPABASE_URL / SUPABASE_ANON_KEY missing in .env — server not configured." });
  }
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Missing bearer token." });
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }

  req.user = { id: data.user.id, email: data.user.email };
  req.token = token;
  next();
};
