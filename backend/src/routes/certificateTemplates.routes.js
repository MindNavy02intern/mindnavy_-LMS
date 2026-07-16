const express = require("express");

const { requireAdminAuth } = require("../middlewares/auth.middleware");
const {
  adminUserActionRateLimiter,
  coursesReadRateLimiter,
} = require("../middlewares/rateLimit.middleware");
const c = require("../controllers/certificates.controller");

// Mounted at /api/admin/certificate-templates (see server.js).
const router = express.Router();

// ── Reads ──────────────────────────────────────────────────────────────────────
router.get("/",    requireAdminAuth, coursesReadRateLimiter, c.listTemplates);
router.get("/:id", requireAdminAuth, coursesReadRateLimiter, c.getTemplate);

// ── Writes ─────────────────────────────────────────────────────────────────────
router.post("/",      requireAdminAuth, adminUserActionRateLimiter, c.createTemplate);
router.patch("/:id",  requireAdminAuth, adminUserActionRateLimiter, c.updateTemplate);
router.delete("/:id", requireAdminAuth, adminUserActionRateLimiter, c.deleteTemplate);

module.exports = router;
