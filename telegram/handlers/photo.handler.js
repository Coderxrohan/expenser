// ============================================================
// Telegram — photo handler
// Receipt photo → OCR → confirm → create expense (+ stored receipt).
// ============================================================
const { client, ledgerUserId } = require("../services/expense.service");
const notification = require("../services/notification.service");
const ocr = require("../../ocr/ocr.service");
const logger = require("../../server/src/utils/logger");

const API = (token) => `https://api.telegram.org/bot${token}`;

async function downloadPhoto(fileId) {
  const meta = await (await fetch(`${API(env.telegramBotToken)}/getFile?file_id=${fileId}`)).json();
  if (!meta.ok) throw new Error("Could not fetch the photo from Telegram.");
  const res = await fetch(`${API(env.telegramBotToken)}/${meta.result.file_path}`);
  return Buffer.from(await res.arrayBuffer());
}

async function handle(message, { sendMessage }) {
  const chatId = message.chat.id;
  const env = require("../../server/src/config/env");

  await sendMessage(chatId, "📷 Reading the receipt…");

  const photo = message.photo?.[message.photo.length - 1] || message.document;
  const buffer = await downloadPhoto(photo.file_id);
  const user_id = await ledgerUserId();

  let ocrResult;
  try {
    ocrResult = await ocr.processReceipt(buffer, "image/jpeg");
  } catch (e) {
    logger.warn("receipt OCR failed:", e.message);
    return sendMessage(chatId, `Couldn't read the receipt (${e.message}). Add it manually with /add.`);
  }

  const { parsed, warnings } = ocrResult;
  if (!parsed.total) {
    return sendMessage(
      chatId,
      "I couldn't find the total on this receipt. Add it manually with /add 500 food, and attach the image again later."
    );
  }

  const summary = [
    "<b>Receipt parsed</b>",
    parsed.merchant ? `Merchant: ${parsed.merchant}` : null,
    `Total: ₹${parsed.total}`,
    parsed.tax ? `Tax: ₹${parsed.tax}` : null,
    parsed.date ? `Date: ${parsed.date}` : `Date: today`,
    `Category: ${parsed.category}`,
    `Method: ${parsed.payment_method}`,
    "",
    warnings.length ? `⚠️ ${warnings.join(" ")}` : "Reply /confirm to save, or /cancel.",
  ].filter(Boolean).join("\n");

  // keep the parsed draft in memory (single-user bot: one draft is enough)
  draft = { ...parsed, user_id, buffer };
  await sendMessage(chatId, summary);
}

let draft = null;

// /confirm and /cancel are handled here via callback handler too.
async function confirmDraft(sendMessage, chatId) {
  if (!draft) return sendMessage(chatId, "No receipt pending. Send a photo first.");
  const supabase = client();
  const d = draft;
  draft = null;

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      type: "expense",
      user_id: d.user_id,
      amount: d.total,
      category: d.category,
      note: d.merchant,
      expense_date: d.date || new Date().toISOString().slice(0, 10),
      payment_method: d.payment_method,
      currency: d.currency,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  // best-effort receipt storage
  try {
    const path = `${d.user_id}/${Date.now()}.jpg`;
    await supabase.storage.from("receipts").upload(path, d.buffer, { contentType: "image/jpeg" });
    await supabase.from("receipts").insert({
      user_id: d.user_id,
      expense_id: data.id,
      storage_path: path,
      mime_type: "image/jpeg",
      ocr_status: "processed",
      ocr_data: { merchant: d.merchant, total: d.total, date: d.date, tax: d.tax, items: d.items },
    });
  } catch (e) {
    logger.warn("receipt storage skipped:", e.message);
  }

  await sendMessage(chatId, `✅ Saved ₹${data.amount} — <b>${data.category}</b>`);
  await notification.expenseConfirmation(data);
}

async function cancelDraft(sendMessage, chatId) {
  draft = null;
  await sendMessage(chatId, "Receipt discarded.");
}

module.exports = { handle, confirmDraft, cancelDraft, getDraft: () => draft };
