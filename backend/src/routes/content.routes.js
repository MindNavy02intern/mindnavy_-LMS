const express = require("express");

const { requireAdminAuth } = require("../middlewares/auth.middleware");
const {
  adminUserActionRateLimiter,
  coursesReadRateLimiter,
} = require("../middlewares/rateLimit.middleware");
const c = require("../controllers/content.controller");

// Mounted at /api/admin/content (see server.js). Library uploads reuse the
// sign → direct upload → confirm pattern from /api/admin/uploads, but land in
// their own bucket under the library/ prefix.
const router = express.Router();

// ── Reads ──────────────────────────────────────────────────────────────────────
router.get("/", requireAdminAuth, coursesReadRateLimiter, c.listContent);

// ── Writes ─────────────────────────────────────────────────────────────────────
router.post("/sign",    requireAdminAuth, adminUserActionRateLimiter, c.sign);
router.post("/confirm", requireAdminAuth, adminUserActionRateLimiter, c.confirm);
router.patch("/:id",    requireAdminAuth, adminUserActionRateLimiter, c.updateContent);
router.delete("/:id",   requireAdminAuth, adminUserActionRateLimiter, c.deleteContent);

module.exports = router;
