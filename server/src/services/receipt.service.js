// ============================================================
// Ledger — receipt service
// Stores receipt images in Supabase Storage (bucket "receipts")
// and keeps OCR results linked to the expense.
// ============================================================
const { createClient } = require("@supabase/supabase-js");
const env = require("../config/env");
const { admin } = require("../config/supabase");
const { ApiError } = require("../middleware/error");
const logger = require("../utils/logger");

const BUCKET = "receipts";
const RECEIPT_BUCKET_SQL = `
-- Run once in Supabase SQL editor if the bucket doesn't exist:
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false)
on conflict (id) do nothing;
`;

function clientFor(token) {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

function assertAdmin() {
  if (!admin) {
    throw new ApiError(
      503,
      "Receipt storage needs SUPABASE_SERVICE_ROLE_KEY in .env (used for storage + audit writes only)."
    );
  }
}

async function listReceipts(token, { month, category } = {}) {
  let query = clientFor(token)
    .from("receipts")
    .select("*, expenses(category, expense_date)")
    .order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let rows = data || [];
  // organize by month / category (done here so it also works on old rows)
  if (month) rows = rows.filter((r) => (r.expenses?.expense_date || "").startsWith(month));
  if (category) rows = rows.filter((r) => r.expenses?.category === category);
  return rows;
}

async function getReceipt(token, id) {
  const { data, error } = await clientFor(token)
    .from("receipts")
    .select("*, expenses(category, expense_date)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new ApiError(404, "Receipt not found.");
  return data;
}

// Signed URL so the client can view the image without a public bucket.
async function getReceiptViewUrl(token, id) {
  const receipt = await getReceipt(token, id);
  assertAdmin();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(receipt.storage_path, 60 * 10);
  if (error) throw new Error(error.message);
  return { ...receipt, viewUrl: data.signedUrl };
}

async function uploadReceipt(token, userId, { buffer, mimeType, expenseId, ocrData }) {
  assertAdmin();
  const db = clientFor(token);

  const ext = mimeType.includes("png") ? "png" : mimeType.includes("pdf") ? "pdf" : "jpg";
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: mimeType, upsert: false });
  if (upErr) throw new Error(upErr.message);

  const { data, error } = await db
    .from("receipts")
    .insert({
      user_id: userId,
      expense_id: expenseId || null,
      storage_path: path,
      mime_type: mimeType,
      ocr_status: ocrData ? "processed" : "pending",
      ocr_data: ocrData || null,
    })
    .select()
    .single();
  if (error) {
    await admin.storage.from(BUCKET).remove([path]);
    throw new Error(error.message);
  }
  return data;
}

// Save OCR results for a previously pending receipt.
async function attachOcrData(token, receiptId, ocrData, { expenseId } = {}) {
  const { data, error } = await clientFor(token)
    .from("receipts")
    .update({
      ocr_status: "processed",
      ocr_data: ocrData,
      ...(expenseId ? { expense_id: expenseId } : {}),
    })
    .eq("id", receiptId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function deleteReceipt(token, receiptId) {
  const receipt = await getReceipt(token, receiptId);
  assertAdmin();
  const { error } = await clientFor(token).from("receipts").delete().eq("id", receiptId);
  if (error) throw new Error(error.message);
  await admin.storage.from(BUCKET).remove([receipt.storage_path]).catch((e) =>
    logger.warn("storage cleanup failed:", e.message)
  );
}

module.exports = {
  BUCKET,
  RECEIPT_BUCKET_SQL,
  listReceipts,
  getReceipt,
  getReceiptViewUrl,
  uploadReceipt,
  attachOcrData,
  deleteReceipt,
};
