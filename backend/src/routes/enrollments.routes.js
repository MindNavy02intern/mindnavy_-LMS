const express = require("express");

const { requireAdminAuth } = require("../middlewares/auth.middleware");
const {
  adminUserActionRateLimiter,
  coursesReadRateLimiter,
} = require("../middlewares/rateLimit.middleware");
const c = require("../controllers/enrollments.controller");

// Mounted at /api/admin/enrollments (see server.js). Built on the existing
// course_enrollments table — every write here moves the LM KPIs and charts.
const router = express.Router();

// ── Reads ──────────────────────────────────────────────────────────────────────
router.get("/", requireAdminAuth, coursesReadRateLimiter, c.listEnrollments);

// ── Writes ─────────────────────────────────────────────────────────────────────
router.post("/",      requireAdminAuth, adminUserActionRateLimiter, c.createEnrollment);
router.patch("/:id",  requireAdminAuth, adminUserActionRateLimiter, c.updateEnrollment);
router.delete("/:id", requireAdminAuth, adminUserActionRateLimiter, c.deleteEnrollment);

module.exports = router;
