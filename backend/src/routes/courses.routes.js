const express = require("express");

const { requireAdminAuth } = require("../middlewares/auth.middleware");
const {
  adminUserActionRateLimiter,
  coursesReadRateLimiter,
} = require("../middlewares/rateLimit.middleware");
const c = require("../controllers/courses.controller");

const router = express.Router();

// Reads — admin auth + a higher read limiter (120/min) so interactive
// filtering / search / pagination does not hit 429.
router.get("/",    requireAdminAuth, coursesReadRateLimiter, c.listCourses);
router.get("/:id", requireAdminAuth, coursesReadRateLimiter, c.getCourse);

// Writes — admin auth + stricter user-action limiter.
router.post("/",           requireAdminAuth, adminUserActionRateLimiter, c.createCourse);
router.patch("/:id",       requireAdminAuth, adminUserActionRateLimiter, c.updateCourse);
router.delete("/:id",      requireAdminAuth, adminUserActionRateLimiter, c.archiveCourse);
router.post("/:id/restore", requireAdminAuth, adminUserActionRateLimiter, c.restoreCourse);

module.exports = router;
