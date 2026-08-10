const express = require("express");

const { requireAdminAuth } = require("../middlewares/auth.middleware");
const { adminUsersAnalyticsRateLimiter } = require("../middlewares/rateLimit.middleware");
const c = require("../controllers/scheduledReports.controller");

// Mounted at /api/admin/reports/scheduled (see server.js) — a separate
// router from reports.routes.js (which owns single-segment /reports/*
// paths) so this module's CRUD doesn't have to live inline in that file.
const router = express.Router();

router.get("/",             requireAdminAuth, adminUsersAnalyticsRateLimiter, c.listScheduledReports);
router.post("/",            requireAdminAuth, adminUsersAnalyticsRateLimiter, c.createScheduledReport);
router.patch("/:id",        requireAdminAuth, adminUsersAnalyticsRateLimiter, c.updateScheduledReport);
router.delete("/:id",       requireAdminAuth, adminUsersAnalyticsRateLimiter, c.deleteScheduledReport);
router.patch("/:id/pause",  requireAdminAuth, adminUsersAnalyticsRateLimiter, c.pauseScheduledReport);
router.patch("/:id/resume", requireAdminAuth, adminUsersAnalyticsRateLimiter, c.resumeScheduledReport);

module.exports = router;
