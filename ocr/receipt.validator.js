// ============================================================
// Ledger — receipt validator
// Sanity checks on parsed OCR data before it's trusted enough
// to create an expense.
// ============================================================

function validate(parsed) {
  const warnings = [];
  if (!parsed) return { valid: false, warnings: ["No parsed data."] };

  if (!parsed.merchant) warnings.push("Merchant not found.");
  if (!parsed.date) warnings.push("Date not found — the expense will default to today.");
  if (!Number.isFinite(parsed.total) || parsed.total <= 0) {
    warnings.push("Total not found or not positive.");
  }
  if (Number.isFinite(parsed.tax) && Number.isFinite(parsed.total) && parsed.tax > parsed.total) {
    warnings.push("Tax is larger than the total — amounts look wrong.");
  }
  if (Array.isArray(parsed.items) && Number.isFinite(parsed.total) && parsed.items.length) {
    const itemSum = parsed.items.reduce((s, i) => s + Number(i.amount || 0), 0);
    if (itemSum > parsed.total * 1.25) {
      warnings.push("Item amounts add up to much more than the total.");
    }
  }
  if (!parsed.category || parsed.category === "Other") {
    warnings.push("Category guessed as 'Other' — review before saving.");
  }

  return { valid: Number.isFinite(parsed.total) && parsed.total > 0, warnings };
}

module.exports = { validate };
