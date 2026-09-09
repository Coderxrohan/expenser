// ============================================================
// Ledger — receipt parser
// Extracts merchant, total, date, tax/GST, items, category,
// payment method and currency from raw OCR text.
// Pure functions — easy to unit test.
// ============================================================

const CATEGORY_HINTS = [
  ["Food", ["restaurant", "cafe", "coffee", "bakery", "pizza", "grocery", "supermarket", "supermart", "kitchen", "dhaba", "hotel", "food", "swiggy", "zomato", "milk", "bread", "eggs"]],
  ["Transport", ["petrol", "fuel", "uber", "ola", "metro", "parking", "toll", "taxi", "railways", "irctc"]],
  ["Shopping", ["mall", "retail", "store", "fashion", "shoes", "apparel", "amazon", "flipkart", "bazaar"]],
  ["Bills", ["electricity", "water bill", "broadband", "internet", "mobile recharge", "airtel", "jio", "vodafone", "gas agency", "rent", "emi"]],
  ["Entertainment", ["cinema", "theatre", "netflix", "spotify", "games", "bookmyshow"]],
  ["Health", ["pharmacy", "medical", "clinic", "hospital", "apollo", "chemist", "dentist"]],
  ["Education", ["books", "school", "college", "course", "tuition", "udemy", "stationery"]],
];

const PAYMENT_HINTS = [
  ["credit_card", ["credit card", "visa", "mastercard", "amex", "rupay credit"]],
  ["debit_card", ["debit card", "maestro"]],
  ["upi", ["upi", "gpay", "google pay", "phonepe", "paytm upi", "bhim"]],
  ["wallet", ["wallet", "paytm wallet", "amazon pay"]],
  ["bank_transfer", ["neft", "imps", "rtgs", "bank transfer"]],
  ["cash", ["cash", "change due", "tendered"]],
];

const CURRENCY_HINTS = [
  ["INR", ["₹", "rs.", "rs ", "inr"]],
  ["USD", ["$", "usd"]],
  ["EUR", ["€", "eur"]],
  ["GBP", ["£", "gbp"]],
];

function firstMatch(textLower, pairs) {
  for (const [value, hints] of pairs) {
    if (hints.some((h) => textLower.includes(h))) return value;
  }
  return null;
}

function extractMerchant(lines) {
  // Merchant is usually one of the first few non-empty lines, and not a
  // phone/address/date line. All-lowercase lines are skipped — real
  // receipt headers are ALL CAPS or Title Case.
  for (const line of lines.slice(0, 5)) {
    const l = line.trim();
    if (l.length < 3 || l.length > 40) continue;
    if (l === l.toLowerCase() && /[a-z]/.test(l)) continue;
    if (/(\d{6,}|www\.|\.com|tel|phone|invoice|receipt|bill|gst)/i.test(l)) continue;
    if (/^[^a-z\u0080-\uFFFF]*$/i.test(l)) continue;
    return l;
  }
  return null;
}

function extractDate(lines) {
  const patterns = [
    /\b(\d{4}-\d{2}-\d{2})\b/,                       // 2026-09-09
    /\b(\d{1,2}[/.-]\d{1,2}[/.-](?:\d{2,4}))\b/,     // 09/09/2026, 9-9-26
    /\b(\d{1,2} [A-Za-z]{3,9},? \d{4})\b/,           // 9 Sep 2026
  ];
  for (const line of lines) {
    for (const re of patterns) {
      const m = line.match(re);
      if (!m) continue;
      const raw = m[1];
      // normalize to YYYY-MM-DD
      let d;
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) d = raw;
      else if (/^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(raw)) {
        const parts = raw.split(/[/.-]/).map(Number);
        let [a, b, y] = parts;
        if (y < 100) y += 2000;
        // assume DD/MM (fallback MM/DD if impossible)
        d = `${y}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`;
        const probe = new Date(d + "T00:00:00");
        if (Number.isNaN(probe.getTime()) || b > 12) {
          d = `${y}-${String(a).padStart(2, "0")}-${String(b).padStart(2, "0")}`;
        }
      } else {
        d = new Date(raw).toISOString().slice(0, 10);
      }
      if (!Number.isNaN(new Date(d + "T00:00:00").getTime())) return d;
    }
  }
  return null;
}

// Money figure immediately after a label (allowing only spaces, colon,
// equals sign and a currency marker in between) — avoids grabbing digits
// that merely appear later in the line, e.g. GSTIN registration numbers.
function moneyAfter(labelRe, line) {
  const m = line.match(labelRe);
  if (!m) return null;
  const rest = line.slice(m.index + m[0].length);
  const cleaned = rest.replace(/^[\s:=]*(?:rs\.?|inr|₹|\$|€|£)?\s*/i, "");
  const num = cleaned.match(/^-?\d[\d,]*(?:\.\d{1,2})?/);
  return num ? Number(num[0].replace(/,/g, "")) : null;
}

function extractTotals(lines, textLower) {
  let total = null;
  let tax = null;
  let subtotal = null;

  for (const line of lines) {
    const l = line.toLowerCase();
    // GSTIN / tax-id lines are registration numbers, not amounts
    if (/gstin|tax id|tax invoice|tax reg/.test(l)) continue;

    if (total === null && /grand total|total amount|amount due|balance due|net amount/.test(l)) {
      total = moneyAfter(/grand total|total amount|amount due|balance due|net amount/, l);
    }
    if (total === null && /(^|\s)total(\s|$|:)/.test(l) && !/sub\s*total/.test(l)) {
      total = moneyAfter(/total/, l);
    }
    if (subtotal === null && /sub\s*total/.test(l)) {
      subtotal = moneyAfter(/sub\s*total/, l);
    }
    if (tax === null && /(cgst|sgst|igst|gst|tax|vat)/.test(l) && /\d/.test(l)) {
      tax = moneyAfter(/(cgst|sgst|igst|gst|tax|vat)/, l);
    }
  }

  // last resort: biggest money figure in the text
  if (total === null) {
    const all = [...textLower.matchAll(/(?:₹|rs\.?|\$|€|£)?\s?(\d[\d,]*(?:\.\d{1,2})?)/g)]
      .map((m) => Number(m[1].replace(/,/g, "")))
      .filter((n) => n > 0);
    if (all.length) total = Math.max(...all);
  }
  return { total, tax, subtotal };
}

// Item lines look like: "name ..... 120.00" or "name 2 x 60.00"
function extractItems(lines) {
  const items = [];
  const totalRe = /(grand total|total amount|amount due|balance due|net amount|sub\s*total|^total|tax|gst|vat|cash|change|card)/i;
  for (const line of lines) {
    if (totalRe.test(line)) continue;
    const m = line.match(/^(.*?)[.\s]{2,}(?:x\s*(\d+)\s*)?(\d[\d,]*(?:\.\d{1,2})?)\s*$/) ||
              line.match(/^(.+?)\s+(\d[\d,]*(?:\.\d{1,2})?)$/);
    if (!m) continue;
    const name = (m[1] || "").replace(/[.\s]+$/, "").trim();
    const amount = Number((m[3] || m[2] || "").replace(/,/g, ""));
    if (!name || name.length < 2 || !Number.isFinite(amount)) continue;
    if (/\d{6,}/.test(name)) continue; // barcodes/phones
    items.push({ name, amount });
  }
  return items.slice(0, 30);
}

function parse(text) {
  const lines = String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const lower = lines.join("\n").toLowerCase();

  const merchant = extractMerchant(lines);
  const date = extractDate(lines);
  const { total, tax, subtotal } = extractTotals(lines, lower);
  const items = extractItems(lines);
  const category = firstMatch(lower, CATEGORY_HINTS) || "Other";
  const payment_method = firstMatch(lower, PAYMENT_HINTS) || "cash";
  const currency = firstMatch(lower, CURRENCY_HINTS) || "INR";

  return {
    merchant,
    date,
    total,
    tax,
    subtotal,
    items,
    category,
    payment_method,
    currency,
    raw_text: text,
  };
}

module.exports = { parse };
