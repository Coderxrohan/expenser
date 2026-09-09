// Tests for ocr/receipt.parser.js
const test = require("node:test");
const assert = require("node:assert");
const parser = require("../../ocr/receipt.parser");

const SAMPLE = `
GREEN BASKET SUPERMART
No 42, MG Road, Bengaluru 560001
Tel: 080-12345678
GSTIN: 29ABCDE1234F1Z5

Invoice #00123          09/09/2026

Milk Packet 1L          62.00
Bread Whole Wheat       45.00
Eggs Tray x 12          96.00

Subtotal               203.00
CGST                    5.00
SGST                    5.00
Total                  213.00

Paid via UPI - PhonePe
`;

test("parses merchant from the top of the receipt", () => {
  const r = parser.parse(SAMPLE);
  assert.equal(r.merchant, "GREEN BASKET SUPERMART");
});

test("parses the date into ISO format", () => {
  const r = parser.parse(SAMPLE);
  assert.equal(r.date, "2026-09-09");
});

test("parses total and tax", () => {
  const r = parser.parse(SAMPLE);
  assert.equal(r.total, 213);
  assert.equal(r.tax, 5);
});

test("extracts item lines with amounts", () => {
  const r = parser.parse(SAMPLE);
  const names = r.items.map((i) => i.name);
  assert.ok(names.includes("Milk Packet 1L"));
  assert.ok(names.includes("Eggs Tray x 12"));
  assert.equal(r.items.find((i) => i.name === "Bread Whole Wheat").amount, 45);
});

test("detects category, payment method and currency", () => {
  const r = parser.parse(SAMPLE);
  assert.equal(r.category, "Food");
  assert.equal(r.payment_method, "upi");
  assert.equal(r.currency, "INR");
});

test("falls back to the largest figure when no total line exists", () => {
  const r = parser.parse("RANDOM SHOP\ncash\n999.50");
  assert.equal(r.total, 999.5);
});

test("returns nulls when the text is garbage", () => {
  const r = parser.parse("kjlasd flkjasd\n1234567890");
  assert.equal(r.merchant, null);
  assert.equal(r.date, null);
});

test("parses ISO dates and 9 Sep 2026 style dates", () => {
  assert.equal(parser.parse("Bill 2026-01-31 total 10").date, "2026-01-31");
  assert.equal(parser.parse("Bill 31 Jan 2026 total 10").date, "2026-01-31");
});
