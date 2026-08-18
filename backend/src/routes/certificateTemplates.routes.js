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

// Logo (sign -> PUT direct to storage -> confirm)
router.post("/:id/logo/sign",    requireAdminAuth, adminUserActionRateLimiter, c.signLogo);
router.post("/:id/logo/confirm", requireAdminAuth, adminUserActionRateLimiter, c.confirmLogo);
router.delete("/:id/logo",       requireAdminAuth, adminUserActionRateLimiter, c.removeLogo);

module.exports = router;
