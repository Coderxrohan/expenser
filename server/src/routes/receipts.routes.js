// ============================================================
// Ledger — receipts routes
// ============================================================
const router = require("express").Router();
const multer = require("multer");
const ctrl = require("../controllers/receipts.controller");
const auth = require("../middleware/auth");
const { asyncHandler } = require("../middleware/error");
const { strictLimiter } = require("../middleware/rateLimit");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

router.use(auth, strictLimiter);

router.get("/", asyncHandler(ctrl.list));
router.get("/:id", asyncHandler(ctrl.get));
router.get("/:id/view", asyncHandler(ctrl.view));
router.post("/", upload.single("receipt"), asyncHandler(ctrl.upload));
router.patch("/:id/ocr", asyncHandler(ctrl.attachOcr));
router.delete("/:id", asyncHandler(ctrl.remove));

module.exports = router;
