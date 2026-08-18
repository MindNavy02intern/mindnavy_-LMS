const express = require("express");

const { requireAdminAuth } = require("../middlewares/auth.middleware");
const { adminUsersAnalyticsRateLimiter, adminUserActionRateLimiter, coursesReadRateLimiter } = require("../middlewares/rateLimit.middleware");
const c = require("../controllers/reports.controller");

// Mounted at /api/admin/reports (see server.js). Every endpoint here is a
// read-heavy aggregation, same limiter convention as every other module's
// /stats and /analytics endpoints (instructors, learners, competencies).
const router = express.Router();

router.get("/overview",    requireAdminAuth, adminUsersAnalyticsRateLimiter, c.getOverview);
router.get("/learners",    requireAdminAuth, adminUsersAnalyticsRateLimiter, c.getLearnerAnalytics);
router.get("/instructors", requireAdminAuth, adminUsersAnalyticsRateLimiter, c.getInstructorAnalytics);
router.get("/courses",     requireAdminAuth, adminUsersAnalyticsRateLimiter, c.getCourseAnalytics);
router.get("/assessments", requireAdminAuth, adminUsersAnalyticsRateLimiter, c.getAssessmentReports);
router.get("/certificates",requireAdminAuth, adminUsersAnalyticsRateLimiter, c.getCertificateReports);
router.get("/attendance",  requireAdminAuth, adminUsersAnalyticsRateLimiter, c.getAttendanceReports);
router.get("/audit",       requireAdminAuth, adminUsersAnalyticsRateLimiter, c.getAuditReports);
router.get("/engagement",  requireAdminAuth, adminUsersAnalyticsRateLimiter, c.getEngagementAnalytics);

// ── Part 2 — Export Center + Compliance ─────────────────────────────────
router.get("/export",     requireAdminAuth, adminUsersAnalyticsRateLimiter, c.exportReport);
router.get("/compliance", requireAdminAuth, adminUsersAnalyticsRateLimiter, c.getComplianceReports);

// ── Custom Reports builder (Saved Reports) — reportTemplate.save, now real ──
router.get("/saved",             requireAdminAuth, coursesReadRateLimiter, c.listSavedReports);
router.post("/saved",            requireAdminAuth, adminUserActionRateLimiter, c.createSavedReport);
router.get("/saved/:id",         requireAdminAuth, coursesReadRateLimiter, c.getSavedReport);
router.patch("/saved/:id",       requireAdminAuth, adminUserActionRateLimiter, c.updateSavedReport);
router.delete("/saved/:id",      requireAdminAuth, adminUserActionRateLimiter, c.deleteSavedReport);
router.post("/saved/:id/run",    requireAdminAuth, adminUserActionRateLimiter, c.runSavedReport);
router.post("/saved/:id/export", requireAdminAuth, adminUserActionRateLimiter, c.exportSavedReport);

module.exports = router;
