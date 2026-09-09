// ============================================================
// Ledger — incomes routes
// ============================================================
const router = require("express").Router();
const ctrl = require("../controllers/incomes.controller");
const auth = require("../middleware/auth");
const { asyncHandler } = require("../middleware/error");

router.use(auth);

router.get("/", asyncHandler(ctrl.list));
router.get("/:id", asyncHandler(ctrl.get));
router.post("/", asyncHandler(ctrl.create));
router.patch("/:id", asyncHandler(ctrl.update));
router.delete("/:id", asyncHandler(ctrl.remove));

module.exports = router;
