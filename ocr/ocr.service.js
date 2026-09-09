// ============================================================
// Ledger — OCR service
// Runs Tesseract.js locally (no API key needed). If OCR_API_KEY
// is set, uses an external OCR HTTP API instead.
// ============================================================
const receiptParser = require("./receipt.parser");
const receiptValidator = require("./receipt.validator");
const env = require("../server/src/config/env");
const logger = require("../server/src/utils/logger");

function isConfigured() {
  return true; // tesseract.js runs locally; external API optional
}

// Optional external OCR (OCR_API_KEY in .env). Returns plain text.
async function ocrViaApi(buffer, mimeType) {
  const res = await fetch("https://api.ocr.space/parse/image", {
    method: "POST",
    headers: {
      apikey: env.ocrApiKey,
      "Content-Type": mimeType || "image/jpeg",
    },
    body: buffer,
  });
  if (!res.ok) throw new Error(`OCR API responded ${res.status}`);
  const data = await res.json();
  const text = Array.isArray(data.ParsedResults)
    ? data.ParsedResults.map((r) => r.ParsedText).join("\n")
    : "";
  if (!text) throw new Error(data.ErrorMessage || "OCR API returned no text");
  return text;
}

// Local OCR via tesseract.js. Lazy-required so the app still boots
// when the optional dependency isn't installed.
async function ocrLocal(buffer) {
  let createWorker;
  try {
    ({ createWorker } = require("tesseract.js"));
  } catch {
    throw new Error("tesseract.js is not installed — run: npm install tesseract.js");
  }
  const worker = await createWorker("eng");
  try {
    const { data } = await worker.recognize(buffer);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

// Full pipeline: image buffer → text → parsed fields → validation.
// Returns { text, parsed, warnings }.
async function processReceipt(buffer, mimeType) {
  let text;
  try {
    text = env.ocrApiKey
      ? await ocrViaApi(buffer, mimeType)
      : await ocrLocal(buffer);
  } catch (e) {
    logger.warn("OCR text extraction failed:", e.message);
    throw e;
  }

  const parsed = receiptParser.parse(text);
  const { valid, warnings } = receiptValidator.validate(parsed);
  return { text, parsed, warnings, valid };
}

// Parse-only, for text that was extracted elsewhere (e.g. Telegram caption).
function parseText(text) {
  const parsed = receiptParser.parse(text);
  const { valid, warnings } = receiptValidator.validate(parsed);
  return { parsed, warnings, valid };
}

module.exports = { isConfigured, processReceipt, parseText };
