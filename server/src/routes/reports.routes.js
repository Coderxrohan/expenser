// ============================================================
// Ledger — reports routes (CSV / PDF / backup / bank import)
// ============================================================
const router = require("express").Router();
const ctrl = require("../controllers/reports.controller");
const auth = require("../middleware/auth");
const { asyncHandler } = require("../middleware/error");
const { strictLimiter } = require("../middleware/rateLimit");

router.use(auth, strictLimiter);

router.get("/expenses.csv", asyncHandler(ctrl.csv));
router.get("/expenses.pdf", asyncHandler(ctrl.pdf));
router.get("/incomes.csv", asyncHandler(ctrl.incomeCsv));
router.get("/incomes.pdf", asyncHandler(ctrl.incomePdf));
router.get("/backup", asyncHandler(ctrl.backup));
router.post("/restore", asyncHandler(ctrl.restore));
router.post("/bank-import", asyncHandler(ctrl.bankImport));

module.exports = router;
