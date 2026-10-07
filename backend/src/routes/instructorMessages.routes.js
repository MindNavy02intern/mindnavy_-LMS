const express = require("express");

const c = require("../controllers/instructorMessages.controller");
const { requireInstructorAuth } = require("../middlewares/instructorAuth.middleware");
const { coursesReadRateLimiter, adminUserActionRateLimiter } = require("../middlewares/rateLimit.middleware");

// Mounted at /api/instructor/messages (see server.js).
const router = express.Router();

router.get("/", requireInstructorAuth, coursesReadRateLimiter, c.listMessages);
router.post("/", requireInstructorAuth, adminUserActionRateLimiter, c.startThread);
router.post("/reply", requireInstructorAuth, adminUserActionRateLimiter, c.reply);
router.patch("/read-all", requireInstructorAuth, adminUserActionRateLimiter, c.markAllRead);
router.patch("/:id/read", requireInstructorAuth, adminUserActionRateLimiter, c.markRead);
router.get("/:id/thread", requireInstructorAuth, coursesReadRateLimiter, c.getThread);

module.exports = router;
