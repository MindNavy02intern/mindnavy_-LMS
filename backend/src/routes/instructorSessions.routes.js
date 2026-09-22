const express = require("express");

const c = require("../controllers/instructorSessions.controller");
const { requireInstructorAuth } = require("../middlewares/instructorAuth.middleware");
const { coursesReadRateLimiter, adminUserActionRateLimiter } = require("../middlewares/rateLimit.middleware");

// Mounted at /api/instructor/sessions (see server.js).
const router = express.Router();

router.get("/", requireInstructorAuth, coursesReadRateLimiter, c.listSessions);
router.delete("/:id", requireInstructorAuth, adminUserActionRateLimiter, c.revokeSession);

module.exports = router;
