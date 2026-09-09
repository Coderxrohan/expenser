// Tests for server/src/utils/validation.js
const test = require("node:test");
const assert = require("node:assert");
const v = require("../../server/src/utils/validation");

test("parseAmount accepts positive numbers and rejects junk", () => {
  assert.equal(v.parseAmount("250.5"), 250.5);
  assert.throws(() => v.parseAmount(0), /positive/);
  assert.throws(() => v.parseAmount(-5), /positive/);
  assert.throws(() => v.parseAmount("abc"), /positive/);
});

test("parseDate enforces YYYY-MM-DD", () => {
  assert.equal(v.parseDate("2026-09-09"), "2026-09-09");
  assert.throws(() => v.parseDate("09-09-2026"), /YYYY-MM-DD/);
  assert.throws(() => v.parseDate("2026-02-30"), /valid date/);
});

test("parseCategory whitelists known categories", () => {
  assert.equal(v.parseCategory("Food"), "Food");
  assert.equal(v.parseCategory(undefined), "Other");
  assert.throws(() => v.parseCategory("Crypto"), /Unknown category/);
});

test("parsePaymentMethod whitelists known methods", () => {
  assert.equal(v.parsePaymentMethod("upi"), "upi");
  assert.equal(v.parsePaymentMethod(undefined), "cash");
  assert.throws(() => v.parsePaymentMethod("barter"), /Unknown payment method/);
});

test("cleanString trims, nulls empties and caps length", () => {
  assert.equal(v.cleanString("  hello  "), "hello");
  assert.equal(v.cleanString("   "), null);
  assert.throws(() => v.cleanString("x".repeat(201), { field: "note" }), /200 characters/);
});
