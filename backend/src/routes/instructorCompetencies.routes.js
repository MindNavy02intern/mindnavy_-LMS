const express = require("express");

const c = require("../controllers/instructorCompetencies.controller");
const { requireInstructorAuth } = require("../middlewares/instructorAuth.middleware");
const { coursesReadRateLimiter } = require("../middlewares/rateLimit.middleware");

// Mounted at /api/instructor/competencies (see server.js). Read-only both
// tabs — skill<->course mapping and competency-certification issuance stay
// admin-only actions.
const router = express.Router();

router.get("/skills-in-my-courses", requireInstructorAuth, coursesReadRateLimiter, c.getCourseSkills);
router.get("/my-certifications", requireInstructorAuth, coursesReadRateLimiter, c.getCertifications);

module.exports = router;
