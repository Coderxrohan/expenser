// ============================================================
// Ledger — environment config
// Every value comes from .env; nothing is hardcoded.
// ============================================================
require("dotenv").config({ path: require("path").join(__dirname, "../../../.env") });

function required(name) {
  const v = process.env[name];
  if (!v) {
    console.warn(`  ⚠  ${name} is not set — add it to .env`);
  }
  return v;
}

module.exports = {
  port: Number(process.env.PORT || 8000),
  nodeEnv: process.env.NODE_ENV || "development",

  supabaseUrl: required("SUPABASE_URL"),
  supabaseAnonKey: required("SUPABASE_ANON_KEY"),
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "", // receipts bucket + audit writes

  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || "",
  telegramChatId: process.env.TELEGRAM_CHAT_ID || "",
  ledgerOwnerEmail: process.env.LEDGER_OWNER_EMAIL || "",

  ocrApiKey: process.env.OCR_API_KEY || "",
};
