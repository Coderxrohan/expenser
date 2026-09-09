// ============================================================
// Ledger — expenses routes
// ============================================================
const router = require("express").Router();
const ctrl = require("../controllers/expenses.controller");
const auth = require("../middleware/auth");
const { asyncHandler } = require("../middleware/error");

router.use(auth);

router.get("/", asyncHandler(ctrl.list));
router.get("/analytics", asyncHandler(ctrl.analytics));
router.get("/:id", asyncHandler(ctrl.get));
router.post("/", asyncHandler(ctrl.create));
router.patch("/:id", asyncHandler(ctrl.update));
router.delete("/:id", asyncHandler(ctrl.remove));

module.exports = router;
