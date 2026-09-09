// ============================================================
// Ledger — client config fallback
//
// When the app is served by the Node server (node server/src/server.js),
// real values live in .env and are injected at /config.js — you never
// need to touch this file.
//
// This fallback is only for static hosting (GitHub Pages, plain FTP)
// where no server runs. Fill in the values below, but never commit
// real keys.
// ============================================================
window.LEDGER_CONFIG = {
  supabaseUrl: "https://tzgwpqdvridmkkzvsyhx.supabase.co",       // e.g. "https://your-project.supabase.co"
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6Z3dwcWR2cmlkbWtrenZzeWh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5Mzg4NjEsImV4cCI6MjEwNDUxNDg2MX0.9XMwGojUysx4wqqp6zdBCleLetJIHlkGOgM84DH-jCs",   // Supabase → Settings → API → anon public key
  clerkPublishableKey: "", // Clerk → API keys → Publishable key (pk_…) — reserved for the future login switch
};
