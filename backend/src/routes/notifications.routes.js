const express = require("express");

const { requireAdminAuth } = require("../middlewares/auth.middleware");
const {
  adminUserActionRateLimiter,
  adminUsersAnalyticsRateLimiter,
  coursesReadRateLimiter,
} = require("../middlewares/rateLimit.middleware");
const c = require("../controllers/notifications.controller");

// Mounted at /api/admin/notifications (see server.js). Sub-resources each own
// a prefix so no bare "/:id" collides with "/stats"/"/analytics"/"/emergency"
// — same ordering convention as competencies.routes.
const router = express.Router();

// ── Module-wide reads ────────────────────────────────────────────────────────
router.get("/stats",     requireAdminAuth, adminUsersAnalyticsRateLimiter, c.getStats);
router.get("/analytics", requireAdminAuth, adminUsersAnalyticsRateLimiter, c.getAnalytics);

// ── In-app notifications ─────────────────────────────────────────────────────
router.get("/",               requireAdminAuth, coursesReadRateLimiter, c.listNotifications);
router.post("/send",          requireAdminAuth, adminUserActionRateLimiter, c.sendNotification);
router.patch("/read-all",     requireAdminAuth, adminUserActionRateLimiter, c.markAllRead);
router.patch("/:id/read",     requireAdminAuth, adminUserActionRateLimiter, c.markRead);
router.delete("/:id",         requireAdminAuth, adminUserActionRateLimiter, c.deleteNotification);

// ── Announcements ─────────────────────────────────────────────────────────────
router.get("/announcements",            requireAdminAuth, coursesReadRateLimiter, c.listAnnouncements);
router.post("/announcements",           requireAdminAuth, adminUserActionRateLimiter, c.createAnnouncement);
router.get("/announcements/:id",        requireAdminAuth, coursesReadRateLimiter, c.getAnnouncement);
router.patch("/announcements/:id",      requireAdminAuth, adminUserActionRateLimiter, c.updateAnnouncement);
router.post("/announcements/:id/send",  requireAdminAuth, adminUserActionRateLimiter, c.sendAnnouncement);
router.patch("/announcements/:id/cancel", requireAdminAuth, adminUserActionRateLimiter, c.cancelAnnouncement);
router.delete("/announcements/:id",     requireAdminAuth, adminUserActionRateLimiter, c.deleteAnnouncement);

// ── Templates ──────────────────────────────────────────────────────────────────
router.get("/templates",           requireAdminAuth, coursesReadRateLimiter, c.listTemplates);
router.post("/templates",          requireAdminAuth, adminUserActionRateLimiter, c.createTemplate);
router.get("/templates/:id",       requireAdminAuth, coursesReadRateLimiter, c.getTemplate);
router.patch("/templates/:id",     requireAdminAuth, adminUserActionRateLimiter, c.updateTemplate);
router.delete("/templates/:id",    requireAdminAuth, adminUserActionRateLimiter, c.deleteTemplate);
router.post("/templates/:id/duplicate", requireAdminAuth, adminUserActionRateLimiter, c.duplicateTemplate);
router.post("/templates/:id/preview",   requireAdminAuth, coursesReadRateLimiter, c.previewTemplate);

// ── Automations ────────────────────────────────────────────────────────────────
router.get("/automations",          requireAdminAuth, coursesReadRateLimiter, c.listAutomations);
router.post("/automations",         requireAdminAuth, adminUserActionRateLimiter, c.createAutomation);
router.patch("/automations/:id",    requireAdminAuth, adminUserActionRateLimiter, c.updateAutomation);
router.patch("/automations/:id/pause",  requireAdminAuth, adminUserActionRateLimiter, c.pauseAutomation);
router.patch("/automations/:id/resume", requireAdminAuth, adminUserActionRateLimiter, c.resumeAutomation);
router.delete("/automations/:id",   requireAdminAuth, adminUserActionRateLimiter, c.deleteAutomation);

// ── Delivery logs ──────────────────────────────────────────────────────────────
router.get("/logs",             requireAdminAuth, coursesReadRateLimiter, c.listLogs);
router.post("/logs/:id/retry",  requireAdminAuth, adminUserActionRateLimiter, c.retryDelivery);

// ── User preferences ────────────────────────────────────────────────────────────
router.get("/preferences/:userId",   requireAdminAuth, coursesReadRateLimiter, c.getPreferences);
router.patch("/preferences/:userId", requireAdminAuth, adminUserActionRateLimiter, c.updatePreferences);

// ── Emergency alert ────────────────────────────────────────────────────────────
router.get("/emergency",  requireAdminAuth, coursesReadRateLimiter, c.listEmergencyAlerts);
router.post("/emergency", requireAdminAuth, adminUserActionRateLimiter, c.sendEmergency);

module.exports = router;
