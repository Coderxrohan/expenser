// ============================================================
// Ledger — incomes controller
// ============================================================
const incomeService = require("../services/income.service");
const { parseAmount, parseDate, cleanString } = require("../utils/validation");

const INCOME_CATEGORIES = [
  "Salary", "Freelance", "Business", "Investment", "Gift", "Other",
];

function parseIncomeCategory(v) {
  if (v === undefined || v === null || v === "") return "Other";
  if (!INCOME_CATEGORIES.includes(v)) {
    const { ApiError } = require("../middleware/error");
    throw new ApiError(400, `Unknown income category "${v}".`);
  }
  return v;
}

function buildPayload(body, { partial = false } = {}) {
  const payload = {};
  if (!partial || body.amount !== undefined) payload.amount = parseAmount(body.amount);
  if (!partial || body.category !== undefined) payload.category = parseIncomeCategory(body.category);
  if (!partial || body.income_date !== undefined) {
    payload.income_date = parseDate(body.income_date) || new Date().toISOString().slice(0, 10);
  }
  if (!partial || body.note !== undefined) payload.note = cleanString(body.note, { field: "note" });
  if (body.currency !== undefined) payload.currency = String(body.currency || "INR").toUpperCase().slice(0, 3);
  return payload;
}

exports.list = async (req, res) => {
  const rows = await incomeService.listIncomes(req.token, {
    from: parseDate(req.query.from, "from") || undefined,
    to: parseDate(req.query.to, "to") || undefined,
    category: req.query.category || undefined,
    search: req.query.search || undefined,
    limit: Math.min(Number(req.query.limit) || 500, 1000),
  });
  res.json({ incomes: rows });
};

exports.get = async (req, res) => {
  const row = await incomeService.getIncome(req.token, req.params.id);
  if (!row) return res.status(404).json({ error: "Income not found." });
  res.json({ income: row });
};

exports.create = async (req, res) => {
  const payload = buildPayload(req.body);
  const row = await incomeService.createIncome(req.token, {
    ...payload,
    user_id: req.user.id,
  });
  res.status(201).json({ income: row });
};

exports.update = async (req, res) => {
  const payload = buildPayload(req.body, { partial: true });
  const row = await incomeService.updateIncome(req.token, req.params.id, payload);
  if (!row) return res.status(404).json({ error: "Income not found." });
  res.json({ income: row });
};

exports.remove = async (req, res) => {
  const row = await incomeService.getIncome(req.token, req.params.id);
  if (!row) return res.status(404).json({ error: "Income not found." });
  await incomeService.deleteIncome(req.token, req.params.id);
  res.json({ deleted: req.params.id });
};
