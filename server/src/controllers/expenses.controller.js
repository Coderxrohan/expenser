// ============================================================
// Ledger — expenses controller
// ============================================================
const expenseService = require("../services/expense.service");
const {
  parseAmount, parseDate, parseCategory, parsePaymentMethod, parseName, cleanString, localISO,
} = require("../utils/validation");

function buildPayload(body, { partial = false } = {}) {
  const payload = {};
  if (!partial || body.amount !== undefined) payload.amount = parseAmount(body.amount);
  // The name is what the expense was for — required on create,
  // optional (only changed when sent) on update.
  if (!partial || body.name !== undefined) payload.name = parseName(body.name);
  if (!partial || body.category !== undefined) payload.category = parseCategory(body.category);
  if (!partial || body.expense_date !== undefined) {
    payload.expense_date = parseDate(body.expense_date) || localISO();
  }
  if (!partial || body.note !== undefined) payload.note = cleanString(body.note, { field: "note" });
  if (body.payment_method !== undefined) payload.payment_method = parsePaymentMethod(body.payment_method);
  if (body.currency !== undefined) payload.currency = String(body.currency || "INR").toUpperCase().slice(0, 3);
  return payload;
}

exports.list = async (req, res) => {
  const rows = await expenseService.listExpenses(req.token, {
    from: parseDate(req.query.from, "from") || undefined,
    to: parseDate(req.query.to, "to") || undefined,
    category: req.query.category || undefined,
    search: req.query.search || undefined,
    limit: Math.min(Number(req.query.limit) || 500, 1000),
  });
  res.json({ expenses: rows });
};

exports.get = async (req, res) => {
  const row = await expenseService.getExpense(req.token, req.params.id);
  if (!row) return res.status(404).json({ error: "Expense not found." });
  res.json({ expense: row });
};

exports.create = async (req, res) => {
  const payload = buildPayload(req.body);
  const row = await expenseService.createExpense(req.token, {
    ...payload,
    user_id: req.user.id,
  });
  res.status(201).json({ expense: row });
};

exports.update = async (req, res) => {
  const payload = buildPayload(req.body, { partial: true });
  const row = await expenseService.updateExpense(req.token, req.params.id, payload);
  if (!row) return res.status(404).json({ error: "Expense not found." });
  res.json({ expense: row });
};

exports.remove = async (req, res) => {
  const row = await expenseService.getExpense(req.token, req.params.id);
  if (!row) return res.status(404).json({ error: "Expense not found." });
  await expenseService.deleteExpense(req.token, req.params.id);
  res.json({ deleted: req.params.id });
};

exports.analytics = async (req, res) => {
  const data = await expenseService.analytics(req.token);
  res.json(data);
};
