const express = require("express");

const c = require("../controllers/instructorEarnings.controller");
const { requireInstructorAuth } = require("../middlewares/instructorAuth.middleware");
const { coursesReadRateLimiter } = require("../middlewares/rateLimit.middleware");

// Mounted at /api/instructor/earnings (see server.js). Read-only —
// approve/hold/complete a payout stay strictly admin-only.
const router = express.Router();

router.get("/summary", requireInstructorAuth, coursesReadRateLimiter, c.getSummary);
router.get("/payouts", requireInstructorAuth, coursesReadRateLimiter, c.listPayouts);

module.exports = router;
