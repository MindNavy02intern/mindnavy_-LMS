const express = require("express");

const { requireAdminAuth } = require("../middlewares/auth.middleware");
const {
  adminUserActionRateLimiter,
  coursesReadRateLimiter,
} = require("../middlewares/rateLimit.middleware");
const c = require("../controllers/learningPaths.controller");

// Mounted at /api/admin/learning-paths (see server.js) — own prefix, no
// fall-through tricks needed (unlike courseBuilder's two-segment course paths).
const router = express.Router();

// ── Reads ──────────────────────────────────────────────────────────────────────
router.get("/",    requireAdminAuth, coursesReadRateLimiter, c.listPaths);
router.get("/:id", requireAdminAuth, coursesReadRateLimiter, c.getPath);

// ── Paths (writes) ───────────────────────────────────────────────────────────────
router.post("/",       requireAdminAuth, adminUserActionRateLimiter, c.createPath);
router.patch("/:id",   requireAdminAuth, adminUserActionRateLimiter, c.updatePath);
router.delete("/:id",  requireAdminAuth, adminUserActionRateLimiter, c.deletePath);

// ── Items (writes) ───────────────────────────────────────────────────────────────
router.post("/:id/items",            requireAdminAuth, adminUserActionRateLimiter, c.addItem);
router.delete("/:id/items/:itemId",  requireAdminAuth, adminUserActionRateLimiter, c.removeItem);

// ── Reorder (bulk write) ─────────────────────────────────────────────────────────
router.patch("/:id/reorder", requireAdminAuth, adminUserActionRateLimiter, c.reorder);

module.exports = router;
