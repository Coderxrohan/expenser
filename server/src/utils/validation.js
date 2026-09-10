// ============================================================
// Ledger — validation helpers
// Small, dependency-free. Throw ApiError(400, …) on bad input.
// ============================================================
const { ApiError } = require("../middleware/error");

const CATEGORIES = [
  "Food", "Transport", "Shopping", "Bills",
  "Entertainment", "Health", "Education", "Other",
];

const PAYMENT_METHODS = ["cash", "upi", "credit_card", "debit_card", "bank_transfer", "wallet"];

function assert(condition, message) {
  if (!condition) throw new ApiError(400, message);
}

function cleanString(v, { max = 200, field = "value" } = {}) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  assert(s.length <= max, `${field} must be at most ${max} characters.`);
  return s;
}

// The short name of an expense/income (what it was for) — required.
function parseName(v, field = "name") {
  const s = String(v ?? "").trim().replace(/\s+/g, " ");
  assert(s, `${field} is required.`);
  assert(s.length <= 120, `${field} must be at most 120 characters.`);
  return s;
}

function parseAmount(v, field = "amount") {
  const n = Number(v);
  assert(Number.isFinite(n) && n > 0, `${field} must be a positive number.`);
  return Math.round(n * 100) / 100;
}

function parseDate(v, field = "date") {
  if (!v) return null;
  const s = String(v);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(s), `${field} must be YYYY-MM-DD.`);
  const [y, m, d] = s.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  // JS Date rolls overflow (2026-02-30 → Mar 2) — verify the round-trip.
  assert(
    date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d,
    `${field} is not a valid date.`
  );
  return s;
}

// Categories are user-managed (Settings on the Connectors page), so
// accept any non-empty name instead of a fixed whitelist.
function parseCategory(v) {
  const name = String(v ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
  if (!name) return "Other";
  return name;
}

function parsePaymentMethod(v) {
  if (v === undefined || v === null || v === "") return "cash";
  assert(PAYMENT_METHODS.includes(v), `Unknown payment method "${v}".`);
  return v;
}

module.exports = {
  CATEGORIES,
  PAYMENT_METHODS,
  assert,
  cleanString,
  parseName,
  parseAmount,
  parseDate,
  parseCategory,
  parsePaymentMethod,
};

// LOCAL date string (toISOString is UTC — wrong day for IST after midnight).
function localISO(d = new Date()) {
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
}

Object.assign(module.exports, { localISO });
