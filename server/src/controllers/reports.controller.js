// ============================================================
// Ledger — reports controller (CSV / PDF / backup)
// ============================================================
const reportService = require("../services/report.service");
const csv = require("../../../reports/csv.service");
const pdf = require("../../../reports/pdf.service");
const { ApiError } = require("../middleware/error");

exports.csv = async (req, res) => {
  const pack = await reportService.reportPack(req.token, {
    from: req.query.from || undefined,
    to: req.query.to || undefined,
  });
  sendCsv(res, pack, "ledger-expenses");
};

exports.pdf = async (req, res) => {
  const pack = await reportService.reportPack(req.token, {
    from: req.query.from || undefined,
    to: req.query.to || undefined,
  });
  sendPdf(res, pack, "ledger-report");
};

// ---- income reports (same shape, income table) ----
exports.incomeCsv = async (req, res) => {
  const pack = await reportService.incomePack(req.token, {
    from: req.query.from || undefined,
    to: req.query.to || undefined,
  });
  sendCsv(res, pack, "ledger-income");
};

exports.incomePdf = async (req, res) => {
  const pack = await reportService.incomePack(req.token, {
    from: req.query.from || undefined,
    to: req.query.to || undefined,
  });
  sendPdf(res, pack, "ledger-income-report");
};

function sendCsv(res, pack, name) {
  const body = csv.buildCsv(pack.rows);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"`
  );
  res.send(body);
}

function sendPdf(res, pack, name) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.pdf"`
  );
  pdf.streamReport(pack, res);
}

exports.backup = async (req, res) => {
  const backup = await reportService.exportBackup(req.token);
  res.setHeader("Content-Disposition", `attachment; filename="ledger-backup-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json(backup);
};

exports.restore = async (req, res) => {
  const result = await reportService.importBackup(req.token, req.user.id, req.body);
  res.json(result);
};

// ---- bank statement import (CSV: date, description, amount) ----
exports.bankImport = async (req, res) => {
  const csvText = typeof req.body === "string" ? req.body : req.body?.csv;
  if (!csvText) throw new ApiError(400, 'Send the raw statement CSV in the body (or {"csv": "…"}).');

  const rows = csv.parseCsv(csvText);
  const { createClient } = require("@supabase/supabase-js");
  const env = require("../config/env");
  const client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${req.token}` } },
  });

  const expenses = [];
  for (const r of rows) {
    const date = r.date || r.Date;
    const amount = Math.abs(Number(r.amount ?? r.Amount));
    const description = r.description || r.Description || r.narration || "Bank import";
    if (!date || !Number.isFinite(amount) || amount <= 0) continue;
    expenses.push({
      user_id: req.user.id,
      amount,
      category: "Other",
      note: String(description).slice(0, 200),
      expense_date: String(date).slice(0, 10),
      payment_method: "bank_transfer",
      type: "expense",
    });
  }
  if (!expenses.length) throw new ApiError(400, "No usable rows found (need date + amount columns).");

  const { error } = await client.from("transactions").insert(expenses);
  if (error) throw new Error(error.message);
  res.json({ imported: expenses.length });
};
