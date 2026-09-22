const express = require("express");

const c = require("../controllers/instructorReviewsSelf.controller");
const { requireInstructorAuth } = require("../middlewares/instructorAuth.middleware");
const { coursesReadRateLimiter } = require("../middlewares/rateLimit.middleware");

// Mounted at /api/instructor/reviews (see server.js). Read-only — no
// approve/remove/flag routes exist here; those stay admin-only per blueprint
// 2.6 (/api/admin/instructors/:id/reviews, instructorReviews.routes wiring
// inside instructors.routes.js).
//
// /stats MUST stay above /:id-shaped routes, but this router has none —
// listed for parity with the rest of the instructor route files anyway.
const router = express.Router();

router.get("/stats", requireInstructorAuth, coursesReadRateLimiter, c.getStats);
router.get("/", requireInstructorAuth, coursesReadRateLimiter, c.listReviews);

module.exports = router;
