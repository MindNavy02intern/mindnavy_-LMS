const express = require("express");

const { requireAdminAuth } = require("../middlewares/auth.middleware");
const {
  adminUserActionRateLimiter,
  coursesReadRateLimiter,
} = require("../middlewares/rateLimit.middleware");
const c = require("../controllers/courseBuilder.controller");

// Mounted at /api/admin (see server.js). Paths here are absolute under that base:
//   /courses/:courseId/sections   /courses/:courseId/reorder
//   /sections/:id                 /sections/:sectionId/lessons
//   /lessons/:id
// courses.routes (mounted at /api/admin/courses) only matches single-segment
// paths (/:id), so these two-segment course paths fall through to this router.
const router = express.Router();

// ── Reads ──────────────────────────────────────────────────────────────────────
router.get("/courses/:courseId/sections", requireAdminAuth, coursesReadRateLimiter, c.listSections);

// ── Sections (writes) ────────────────────────────────────────────────────────────
router.post("/courses/:courseId/sections", requireAdminAuth, adminUserActionRateLimiter, c.createSection);
router.patch("/sections/:id",              requireAdminAuth, adminUserActionRateLimiter, c.updateSection);
router.delete("/sections/:id",             requireAdminAuth, adminUserActionRateLimiter, c.deleteSection);

// ── Lessons (writes) ─────────────────────────────────────────────────────────────
router.post("/sections/:sectionId/lessons", requireAdminAuth, adminUserActionRateLimiter, c.createLesson);
router.patch("/lessons/:id",                requireAdminAuth, adminUserActionRateLimiter, c.updateLesson);
router.delete("/lessons/:id",               requireAdminAuth, adminUserActionRateLimiter, c.deleteLesson);

// ── Reorder (bulk write) ─────────────────────────────────────────────────────────
router.patch("/courses/:courseId/reorder", requireAdminAuth, adminUserActionRateLimiter, c.reorder);

module.exports = router;
