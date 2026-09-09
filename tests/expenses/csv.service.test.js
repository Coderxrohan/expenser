// Tests for reports/csv.service.js
const test = require("node:test");
const assert = require("node:assert");
const csv = require("../../reports/csv.service");

test("builds a CSV with header and escaped fields", () => {
  const out = csv.buildCsv([
    { expense_date: "2026-09-09", category: "Food", amount: 213, payment_method: "upi", note: 'eggs, "12" pack' },
  ]);
  const lines = out.trim().split("\r\n");
  assert.equal(lines[0], "date,category,amount,payment_method,note");
  assert.ok(lines[1].includes('"eggs, ""12"" pack"'));
});

test("round-trips quoted commas and newlines", () => {
  const text = 'date,note\n2026-09-09,"line1\nline2, with comma"';
  const rows = csv.parseCsv(text);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].date, "2026-09-09");
  assert.equal(rows[0].note, "line1\nline2, with comma");
});

test("parses plain bank-statement style rows", () => {
  const rows = csv.parseCsv("Date,Description,Amount\n2026-09-01,SWIGGY,450.50\n2026-09-02,UBER,120\n");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].amount, "450.50");
  assert.equal(rows[1].description, "UBER");
});

test("returns empty array for empty input", () => {
  assert.deepEqual(csv.parseCsv(""), []);
});
