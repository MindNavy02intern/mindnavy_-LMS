const express = require("express");

const c = require("../controllers/instructorStudents.controller");
const { requireInstructorAuth } = require("../middlewares/instructorAuth.middleware");
const { coursesReadRateLimiter } = require("../middlewares/rateLimit.middleware");

// Mounted at /api/instructor/students (see server.js). Read-only — no
// write routes exist here by design this phase (see instructorStudents.
// service.js header comment).
const router = express.Router();

router.get("/", requireInstructorAuth, coursesReadRateLimiter, c.listStudents);
router.get("/:id", requireInstructorAuth, coursesReadRateLimiter, c.getStudent);
router.get("/:id/assessments", requireInstructorAuth, coursesReadRateLimiter, c.getAssessments);
router.get("/:id/attendance", requireInstructorAuth, coursesReadRateLimiter, c.getAttendance);

module.exports = router;
