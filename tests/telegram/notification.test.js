// Tests for telegram notification chat gating
const test = require("node:test");
const assert = require("node:assert");

process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://test.supabase.co";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "test-anon-key";
process.env.TELEGRAM_CHAT_ID = "424242";

// env.js reads process.env at require time and Node caches modules —
// drop the cached copies so the vars set below are picked up.
delete require.cache[require.resolve("../../server/src/config/env")];
delete require.cache[require.resolve("../../telegram/services/notification.service")];

const notification = require("../../telegram/services/notification.service");

test("only the configured chat is allowed", () => {
  assert.equal(notification.allowedChat(undefined, 424242), true);
  assert.equal(notification.allowedChat(undefined, "424242"), true); // string chat ids from Telegram
  assert.equal(notification.allowedChat(undefined, 111111), false);
  assert.equal(notification.allowedChat(undefined, undefined), false);
});
