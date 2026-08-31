const express = require("express");

const c = require("../controllers/instructorNotifications.controller");
const { requireInstructorAuth } = require("../middlewares/instructorAuth.middleware");
const { coursesReadRateLimiter, adminUserActionRateLimiter } = require("../middlewares/rateLimit.middleware");

// Mounted at /api/instructor/notifications (see server.js). /preferences
// routes live here too (same URL prefix, blueprint 2.12) rather than a
// separate file — they share this module's service (notifications.service.js)
// and there's no :id-shadowing risk since "preferences" is a literal segment.
const router = express.Router();

router.get("/preferences", requireInstructorAuth, coursesReadRateLimiter, c.getPreferences);
router.patch("/preferences", requireInstructorAuth, adminUserActionRateLimiter, c.updatePreferences);

router.get("/", requireInstructorAuth, coursesReadRateLimiter, c.listNotifications);
router.patch("/read-all", requireInstructorAuth, adminUserActionRateLimiter, c.markAllRead);
router.patch("/:id/read", requireInstructorAuth, adminUserActionRateLimiter, c.markRead);

module.exports = router;
