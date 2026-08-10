const express = require("express");

const { requireAdminAuth } = require("../middlewares/auth.middleware");
const {
  adminUserActionRateLimiter,
  adminUsersAnalyticsRateLimiter,
  coursesReadRateLimiter,
} = require("../middlewares/rateLimit.middleware");
const c = require("../controllers/integrations.controller");

// Mounted at /api/admin/integrations (see server.js). Sub-resources each own a
// prefix (api-keys, webhooks, logs, syncs, stats, analytics) so none collide
// with the bare "/:slug" registry routes below them — same ordering
// convention as notifications.routes/competencies.routes.
const router = express.Router();

// ── Module-wide reads ────────────────────────────────────────────────────────
router.get("/stats",     requireAdminAuth, adminUsersAnalyticsRateLimiter, c.getStats);
router.get("/analytics", requireAdminAuth, adminUsersAnalyticsRateLimiter, c.getAnalytics);

// ── API Keys ─────────────────────────────────────────────────────────────────
router.get("/api-keys",              requireAdminAuth, coursesReadRateLimiter,   c.listApiKeys);
router.post("/api-keys",             requireAdminAuth, adminUserActionRateLimiter, c.generateApiKey);
router.patch("/api-keys/:id/revoke", requireAdminAuth, adminUserActionRateLimiter, c.revokeApiKey);
router.delete("/api-keys/:id",       requireAdminAuth, adminUserActionRateLimiter, c.deleteApiKey);

// ── Webhooks ─────────────────────────────────────────────────────────────────
router.get("/webhooks",              requireAdminAuth, coursesReadRateLimiter,   c.listWebhooks);
router.post("/webhooks",             requireAdminAuth, adminUserActionRateLimiter, c.createWebhook);
router.patch("/webhooks/:id",        requireAdminAuth, adminUserActionRateLimiter, c.updateWebhook);
router.patch("/webhooks/:id/pause",  requireAdminAuth, adminUserActionRateLimiter, c.pauseWebhook);
router.patch("/webhooks/:id/resume", requireAdminAuth, adminUserActionRateLimiter, c.resumeWebhook);
router.patch("/webhooks/:id/test",   requireAdminAuth, adminUserActionRateLimiter, c.testWebhook);
router.delete("/webhooks/:id",       requireAdminAuth, adminUserActionRateLimiter, c.deleteWebhook);

// ── Logs ─────────────────────────────────────────────────────────────────────
router.get("/logs", requireAdminAuth, coursesReadRateLimiter, c.listLogs);

// ── Data Sync ────────────────────────────────────────────────────────────────
router.get("/syncs",                          requireAdminAuth, coursesReadRateLimiter,   c.listSyncs);
router.get("/syncs/:id",                      requireAdminAuth, coursesReadRateLimiter,   c.getSyncById);
router.post("/syncs/:integrationSlug/trigger", requireAdminAuth, adminUserActionRateLimiter, c.triggerSync);

// ── Registry (catalog) ────────────────────────────────────────────────────────
router.get("/",                    requireAdminAuth, coursesReadRateLimiter,   c.listIntegrations);
router.get("/:slug",               requireAdminAuth, coursesReadRateLimiter,   c.getIntegration);
router.patch("/:slug/connect",     requireAdminAuth, adminUserActionRateLimiter, c.connectIntegration);
router.patch("/:slug/disconnect",  requireAdminAuth, adminUserActionRateLimiter, c.disconnectIntegration);
router.patch("/:slug/test",        requireAdminAuth, adminUserActionRateLimiter, c.testIntegration);
router.patch("/:slug/toggle",      requireAdminAuth, adminUserActionRateLimiter, c.toggleIntegration);

module.exports = router;
