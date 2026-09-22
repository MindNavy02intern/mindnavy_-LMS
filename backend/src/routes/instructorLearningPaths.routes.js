const express = require("express");

const c = require("../controllers/instructorLearningPaths.controller");
const { requireInstructorAuth } = require("../middlewares/instructorAuth.middleware");
const { coursesReadRateLimiter } = require("../middlewares/rateLimit.middleware");

// Mounted at /api/instructor/learning-paths (see server.js). Read-only —
// instructors don't create/edit paths, only see which ones include their
// own courses (blueprint gap — not documented in the instructor blueprint
// at all, built per explicit task spec).
const router = express.Router();

router.get("/", requireInstructorAuth, coursesReadRateLimiter, c.listPaths);
router.get("/:id", requireInstructorAuth, coursesReadRateLimiter, c.getPath);

module.exports = router;
