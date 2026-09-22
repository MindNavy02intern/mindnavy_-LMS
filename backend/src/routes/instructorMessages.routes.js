const express = require("express");

const c = require("../controllers/instructorMessages.controller");
const { requireInstructorAuth } = require("../middlewares/instructorAuth.middleware");
const { coursesReadRateLimiter, adminUserActionRateLimiter } = require("../middlewares/rateLimit.middleware");

// Mounted at /api/instructor/messages (see server.js).
const router = express.Router();

router.get("/", requireInstructorAuth, coursesReadRateLimiter, c.listMessages);
router.post("/reply", requireInstructorAuth, adminUserActionRateLimiter, c.reply);
router.patch("/:id/read", requireInstructorAuth, adminUserActionRateLimiter, c.markRead);

module.exports = router;
