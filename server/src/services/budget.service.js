// ============================================================
// Ledger — budget service
// Budgets were dropped from the database schema (merged into
// `transactions`); these stubs keep the mounted /api/budgets
// routes harmless until the routes are removed.
// ============================================================

async function listBudgets() {
  return [];
}

async function upsertBudget() {
  const { ApiError } = require("../middleware/error");
  throw new ApiError(410, "Budgets were removed from the schema.");
}

async function deleteBudget() {
  const { ApiError } = require("../middleware/error");
  throw new ApiError(410, "Budgets were removed from the schema.");
}

async function budgetStatus() {
  return [];
}

module.exports = { listBudgets, upsertBudget, deleteBudget, budgetStatus };
