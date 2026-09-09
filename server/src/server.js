// ============================================================
// Ledger — server entry point
// Serves the API under /api and the client/ static files.
// Run: node server/src/server.js  (from the repo root)
// ============================================================
const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const env = require("./config/env");
const { apiLimiter } = require("./middleware/rateLimit");
const { notFound, errorHandler } = require("./middleware/error");

const expensesRoutes = require("./routes/expenses.routes");
const budgetsRoutes = require("./routes/budgets.routes");
const reportsRoutes = require("./routes/reports.routes");
const receiptsRoutes = require("./routes/receipts.routes");

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.text({ type: ["text/csv", "text/plain"], limit: "5mb" }));
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

app.get("/api/health", (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

app.use("/api", apiLimiter);
app.use("/api/expenses", expensesRoutes);
app.use("/api/budgets", budgetsRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/receipts", receiptsRoutes);

// Telegram webhook (token comes from .env)
try {
  const telegram = require("../../telegram/bot");
  telegram.mountTelegram(app);
} catch (e) {
  console.warn("  ⚠  Telegram bot not mounted:", e.message);
}

// ---- static client ----
const clientDir = path.join(__dirname, "../../client");

// config.js is generated from .env — real keys never live in source.
app.get("/config.js", (req, res) => {
  const config = {
    supabaseUrl: env.supabaseUrl,
    supabaseAnonKey: env.supabaseAnonKey,
    clerkPublishableKey: process.env.CLERK_PUBLISHABLE_KEY || "",
  };
  res
    .type("application/javascript")
    .set("Cache-Control", "no-store")
    .send("// Generated from .env — do not edit. Change values in .env and restart.\n" +
      "window.LEDGER_CONFIG = " + JSON.stringify(config, null, 2) + ";\n");
});

app.use(express.static(clientDir));
app.get("/", (req, res) => res.sendFile(path.join(clientDir, "index.html")));

app.use(notFound);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`\n  Ledger → http://localhost:${env.port}\n`);
});
