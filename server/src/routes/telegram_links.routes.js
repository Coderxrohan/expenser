// ============================================================
// Ledger — telegram links routes
// ============================================================
const router = require("express").Router();
const ctrl = require("../controllers/telegram_links.controller");
const auth = require("../middleware/auth");
const { asyncHandler } = require("../middleware/error");

router.use(auth);

router.get("/", asyncHandler(ctrl.list));
router.post("/", asyncHandler(ctrl.create));
router.patch("/:id", asyncHandler(ctrl.update));
router.delete("/:id", asyncHandler(ctrl.remove));

module.exports = router;
