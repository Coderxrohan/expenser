// ============================================================
// Ledger — PDF report service (pdfkit, streamed to the response)
// ============================================================
const PDFDocument = require("pdfkit");

const CURRENCY = "₹";
const money = (n) => CURRENCY + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function streamReport(pack, res) {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  doc.pipe(res);
  // A client aborting the download must not crash the server
  // (write-after-end on the response stream kills the process).
  // pdfkit 0.15 has no abort(); swallowing the stream errors is enough.
  res.on("error", () => {});

  const range = pack.from || pack.to
    ? `${pack.from || "…"} to ${pack.to || "…"}`
    : "All time";

  doc.font("Helvetica-Bold").fontSize(20).text("Ledger — Expense Report");
  doc.font("Helvetica").fontSize(10).fillColor("#555")
    .text(`Period: ${range}`)
    .text(`Generated: ${new Date(pack.generatedAt).toLocaleString()}`)
    .moveDown(1);
  doc.fillColor("#000");

  doc.font("Helvetica-Bold").fontSize(12);
  doc.text(`Transactions: ${pack.rowCount}`);
  doc.text(`Total: ${money(pack.total)}`);
  doc.moveDown(1);

  // summary tables side by side
  const colWidth = (doc.page.width - 100) / 2;
  const top = doc.y;
  doc.fontSize(11).text("By category", { continued: false, width: colWidth });
  let y = doc.y + 4;
  for (const { category, amount } of pack.byCategory) {
    doc.font("Helvetica").fontSize(9.5);
    doc.text(category, 50, y, { width: colWidth - 60 });
    doc.text(money(amount), 50, y, { width: colWidth, align: "right" });
    y += 14;
  }

  let y2 = top + 18;
  doc.font("Helvetica-Bold").fontSize(11).text("By payment method", 50 + colWidth + 20, y2 - 18);
  y2 = doc.y + 4;
  for (const { method, amount } of pack.byPaymentMethod) {
    doc.font("Helvetica").fontSize(9.5);
    doc.text(method.replace("_", " "), 50 + colWidth + 20, y2, { width: colWidth - 60 });
    doc.text(money(amount), 50 + colWidth + 20, y2, { width: colWidth, align: "right" });
    y2 += 14;
  }

  doc.y = Math.max(y, y2) + 14;

  // ledger table
  doc.font("Helvetica-Bold").fontSize(11).text("Transactions").moveDown(0.5);
  const cols = { date: 50, category: 150, note: 250, amount: 470 };
  doc.fontSize(9);
  doc.text("Date", cols.date);
  doc.text("Category", cols.category);
  doc.text("Note", cols.note);
  doc.text("Amount", cols.amount, doc.y, { align: "right" });
  doc.moveDown(0.4);

  doc.font("Helvetica");
  for (const e of pack.rows) {
    if (doc.y > doc.page.height - 80) doc.addPage();
    const lineY = doc.y;
    doc.fontSize(8.5);
    doc.text(e.expense_date, cols.date, lineY);
    doc.text(e.category, cols.category, lineY, { width: 90, ellipsis: true });
    doc.text(e.note || "—", cols.note, lineY, { width: 205, ellipsis: true });
    doc.text(money(e.amount), cols.amount, lineY, { align: "right" });
    doc.y = lineY + 14;
  }

  doc.end();
}

module.exports = { streamReport };
