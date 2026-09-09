// Tests for expense.service analytics helpers (pure parts)
const test = require("node:test");
const assert = require("node:assert");
const { monthRange } = require("../../server/src/services/expense.service");

test("monthRange returns first and last day of the month", () => {
  const { start, end } = monthRange(new Date(2026, 8, 9)); // Sep 2026
  assert.equal(start, "2026-09-01");
  assert.equal(end, "2026-09-30");
});

test("monthRange handles leap-year February", () => {
  const { start, end } = monthRange(new Date(2028, 1, 5));
  assert.equal(start, "2028-02-01");
  assert.equal(end, "2028-02-29");
});
