// ============================================================
// Ledger — budgets routes
// ============================================================
const router = require("express").Router();
const ctrl = require("../controllers/budgets.controller");
const auth = require("../middleware/auth");
const { asyncHandler } = require("../middleware/error");

router.use(auth);

router.get("/", asyncHandler(ctrl.list));
router.get("/status", asyncHandler(ctrl.status));
router.post("/", asyncHandler(ctrl.upsert));
router.put("/", asyncHandler(ctrl.upsert));
router.delete("/:id", asyncHandler(ctrl.remove));

module.exports = router;
