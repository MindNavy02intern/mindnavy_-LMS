const express = require("express");

const { requireAdminAuth } = require("../middlewares/auth.middleware");
const { adminUserActionRateLimiter } = require("../middlewares/rateLimit.middleware");
const c = require("../controllers/uploads.controller");

// Mounted at /api/admin/uploads (see server.js). All writes; the stricter
// user-action limiter is enough (these are infrequent, one per file).
const router = express.Router();

router.post("/sign",    requireAdminAuth, adminUserActionRateLimiter, c.sign);
router.post("/confirm", requireAdminAuth, adminUserActionRateLimiter, c.confirm);
router.delete("/",      requireAdminAuth, adminUserActionRateLimiter, c.remove);

module.exports = router;
