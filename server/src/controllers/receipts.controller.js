// ============================================================
// Ledger — receipts controller
// ============================================================
const receiptService = require("../services/receipt.service");
const ocr = require("../../../ocr/ocr.service");

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_BYTES = 8 * 1024 * 1024;

exports.list = async (req, res) => {
  const rows = await receiptService.listReceipts(req.token, {
    month: req.query.month || undefined,     // e.g. 2026-09
    category: req.query.category || undefined,
  });
  res.json({ receipts: rows });
};

exports.get = async (req, res) => {
  res.json({ receipt: await receiptService.getReceipt(req.token, req.params.id) });
};

exports.view = async (req, res) => {
  res.json({ receipt: await receiptService.getReceiptViewUrl(req.token, req.params.id) });
};

exports.upload = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Attach a receipt image (field name: receipt)." });
  if (!ALLOWED_MIME.includes(req.file.mimetype)) {
    return res.status(400).json({ error: `Unsupported type ${req.file.mimetype}. Use JPEG, PNG, WebP or PDF.` });
  }
  if (req.file.size > MAX_BYTES) {
    return res.status(400).json({ error: "Receipt is larger than 8 MB." });
  }

  // Run OCR inline when a key is configured; store whatever we parsed.
  let ocrData = null;
  if (ocr.isConfigured()) {
    try {
      const result = await ocr.processReceipt(req.file.buffer, req.file.mimetype);
      ocrData = result.parsed || result.raw || null;
    } catch (e) {
      // OCR failure must not lose the receipt — store as pending.
      req.log?.warn?.("OCR failed:", e.message);
    }
  }

  const receipt = await receiptService.uploadReceipt(req.token, req.user.id, {
    buffer: req.file.buffer,
    mimeType: req.file.mimetype,
    expenseId: req.body.expense_id || null,
    ocrData,
  });
  res.status(201).json({ receipt });
};

exports.attachOcr = async (req, res) => {
  const receipt = await receiptService.attachOcrData(
    req.token,
    req.params.id,
    req.body.ocr_data || null,
    { expenseId: req.body.expense_id }
  );
  res.json({ receipt });
};

exports.remove = async (req, res) => {
  await receiptService.deleteReceipt(req.token, req.params.id);
  res.json({ deleted: req.params.id });
};
