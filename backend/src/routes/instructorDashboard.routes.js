const express = require("express");

const { getStats, getEnrollmentTrend, getActivity } = require("../controllers/instructorDashboard.controller");
const { requireInstructorAuth } = require("../middlewares/instructorAuth.middleware");
const { coursesReadRateLimiter } = require("../middlewares/rateLimit.middleware");

// Mounted at /api/instructor/dashboard (see server.js). Every route requires
// a real instructor session — there is no :id in any of these paths, unlike
// the admin equivalents, because there is nothing to scope beyond "whoever
// is logged in."
const router = express.Router();

router.get("/stats", requireInstructorAuth, coursesReadRateLimiter, getStats);
router.get("/enrollment-trend", requireInstructorAuth, coursesReadRateLimiter, getEnrollmentTrend);
router.get("/activity", requireInstructorAuth, coursesReadRateLimiter, getActivity);

module.exports = router;
