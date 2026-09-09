// Tests for ocr/receipt.validator.js
const test = require("node:test");
const assert = require("node:assert");
const { validate } = require("../../ocr/receipt.validator");

test("valid receipt passes with no warnings", () => {
  const { valid, warnings } = validate({
    merchant: "Cafe",
    date: "2026-09-09",
    total: 250,
    tax: 12,
    items: [{ name: "Latte", amount: 250 }],
    category: "Food",
  });
  assert.equal(valid, true);
  assert.equal(warnings.length, 0);
});

test("missing total is invalid", () => {
  const { valid } = validate({ merchant: "Cafe", total: null });
  assert.equal(valid, false);
});

test("tax larger than total warns", () => {
  const { warnings } = validate({ total: 100, tax: 150 });
  assert.ok(warnings.some((w) => /tax/i.test(w)));
});

test("items summing far above the total warns", () => {
  const { warnings } = validate({
    total: 100,
    items: [{ name: "a", amount: 90 }, { name: "b", amount: 90 }],
  });
  assert.ok(warnings.some((w) => /item/i.test(w)));
});

test("unknown category suggests review", () => {
  const { warnings } = validate({ total: 50, category: "Other" });
  assert.ok(warnings.some((w) => /other/i.test(w)));
});
