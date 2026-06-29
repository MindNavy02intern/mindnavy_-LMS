const express = require("express");

const { requireAdminAuth } = require("../middlewares/auth.middleware");
const { adminUsersAnalyticsRateLimiter } = require("../middlewares/rateLimit.middleware");
const c = require("../controllers/lm.controller");

const router = express.Router();

// Every Learning Management Overview endpoint is read-only aggregation behind
// admin auth. Applying both middlewares router-wide guarantees no endpoint can
// accidentally ship without auth, and the analytics limiter throttles repeated
// heavy aggregation queries.
router.use(requireAdminAuth, adminUsersAnalyticsRateLimiter);

router.get("/stats",          c.getStats);
router.get("/distribution",   c.getDistribution);
router.get("/progress",       c.getProgress);
router.get("/top-courses",    c.getTopCourses);
router.get("/content-stats",  c.getContentStats);
router.get("/courses",        c.getCourses);
router.get("/activities",     c.getActivities);
router.get("/live-sessions",  c.getLiveSessions);
router.get("/filter-options", c.getFilterOptions);

module.exports = router;
