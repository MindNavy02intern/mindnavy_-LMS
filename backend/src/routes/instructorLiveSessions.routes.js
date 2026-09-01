const express = require("express");

const c = require("../controllers/instructorLiveSessions.controller");
const { requireInstructorAuth } = require("../middlewares/instructorAuth.middleware");
const {
  coursesReadRateLimiter,
  adminUserActionRateLimiter,
} = require("../middlewares/rateLimit.middleware");

// Mounted at /api/instructor/live-sessions (see server.js).
const router = express.Router();

router.get("/", requireInstructorAuth, coursesReadRateLimiter, c.listSessions);
router.get("/:id", requireInstructorAuth, coursesReadRateLimiter, c.getSession);
router.post("/", requireInstructorAuth, adminUserActionRateLimiter, c.createSession);
router.patch("/:id", requireInstructorAuth, adminUserActionRateLimiter, c.updateSession);
router.delete("/:id", requireInstructorAuth, adminUserActionRateLimiter, c.deleteSession);
router.patch("/:id/end", requireInstructorAuth, adminUserActionRateLimiter, c.endSession);
router.patch("/:id/attendance", requireInstructorAuth, adminUserActionRateLimiter, c.markAttendance);

module.exports = router;
