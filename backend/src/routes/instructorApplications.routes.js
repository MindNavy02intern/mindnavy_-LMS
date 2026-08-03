const express = require("express");

const { requireAdminAuth } = require("../middlewares/auth.middleware");
const {
  adminUserActionRateLimiter,
  coursesReadRateLimiter,
} = require("../middlewares/rateLimit.middleware");
const c = require("../controllers/instructorApplications.controller");

// Mounted at /api/admin/instructor-applications (see server.js) — the review
// side of the "Become Instructor" queue. Submissions come in through
// publicInstructorApplications.routes.
const router = express.Router();

router.get("/",    requireAdminAuth, coursesReadRateLimiter, c.listApplications);
router.get("/:id", requireAdminAuth, coursesReadRateLimiter, c.getApplication);

// Approve creates a real AppUser + InstructorProfile in one transaction.
router.patch("/:id/approve",         requireAdminAuth, adminUserActionRateLimiter, c.approveApplication);
router.patch("/:id/reject",          requireAdminAuth, adminUserActionRateLimiter, c.rejectApplication);
router.patch("/:id/request-changes", requireAdminAuth, adminUserActionRateLimiter, c.requestChanges);

module.exports = router;
