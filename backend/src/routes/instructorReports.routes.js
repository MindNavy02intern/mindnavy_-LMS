const express = require("express");

const c = require("../controllers/instructorReports.controller");
const { requireInstructorAuth } = require("../middlewares/instructorAuth.middleware");
const { coursesReadRateLimiter } = require("../middlewares/rateLimit.middleware");

// Mounted at /api/instructor/reports (see server.js). Read-only analytics.
const router = express.Router();

router.get("/overview", requireInstructorAuth, coursesReadRateLimiter, c.getOverview);
router.get("/courses", requireInstructorAuth, coursesReadRateLimiter, c.getCourseBreakdown);

module.exports = router;
