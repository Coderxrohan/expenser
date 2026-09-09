// Smoke test — budget service module loads and exports the API surface
const test = require("node:test");
const assert = require("node:assert");
const svc = require("../../server/src/services/budget.service");

test("budget service exposes the expected functions", () => {
  ["listBudgets", "upsertBudget", "deleteBudget", "budgetStatus"].forEach((fn) =>
    assert.equal(typeof svc[fn], "function")
  );
});
