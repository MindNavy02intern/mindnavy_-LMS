const express = require("express");

const { requireAdminAuth } = require("../middlewares/auth.middleware");
const {
  adminUserActionRateLimiter,
  coursesReadRateLimiter,
} = require("../middlewares/rateLimit.middleware");
const c = require("../controllers/courseWorkflow.controller");

// Mounted at /api/admin (see server.js). Two-segment /courses/:id/* paths fall
// through courses.routes (which only matches single-segment /:id) to here —
// same pattern as courseBuilder.routes.
const router = express.Router();

// ── Wizard Step 4: settings (single owner of the settings fields) ───────────────
router.patch("/courses/:id/settings", requireAdminAuth, adminUserActionRateLimiter, c.updateSettings);

// ── Wizard Step 5: read-only preview (course + full section/lesson tree) ────────
router.get("/courses/:id/preview", requireAdminAuth, coursesReadRateLimiter, c.getPreview);

// ── Wizard Step 6 + approval workflow: the ONLY status-transition paths ──────────
router.post("/courses/:id/submit",  requireAdminAuth, adminUserActionRateLimiter, c.submitCourse);
router.post("/courses/:id/approve", requireAdminAuth, adminUserActionRateLimiter, c.approveCourse);
router.post("/courses/:id/reject",  requireAdminAuth, adminUserActionRateLimiter, c.rejectCourse);

module.exports = router;
