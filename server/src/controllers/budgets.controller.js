// ============================================================
// Ledger — budgets controller
// ============================================================
const budgetService = require("../services/budget.service");
const { parseAmount, parseCategory, assert } = require("../utils/validation");

exports.list = async (req, res) => {
  res.json({ budgets: await budgetService.listBudgets(req.token) });
};

exports.status = async (req, res) => {
  res.json({ budgets: await budgetService.budgetStatus(req.token) });
};

exports.upsert = async (req, res) => {
  assert(req.body.category, "category is required.");
  const row = await budgetService.upsertBudget(req.token, {
    category: parseCategory(req.body.category),
    monthly_limit: parseAmount(req.body.monthly_limit ?? req.body.amount, "monthly_limit"),
  });
  res.json({ budget: row });
};

exports.remove = async (req, res) => {
  await budgetService.deleteBudget(req.token, req.params.id);
  res.json({ deleted: req.params.id });
};
