const express = require("express");

const { requireAdminAuth } = require("../middlewares/auth.middleware");
const { adminUserActionRateLimiter, coursesReadRateLimiter } = require("../middlewares/rateLimit.middleware");
const c = require("../controllers/settings.controller");

// Mounted at /api/admin/system-settings (see server.js).
const router = express.Router();

router.get("/",     requireAdminAuth, coursesReadRateLimiter,   c.getSettings);
router.patch("/",   requireAdminAuth, adminUserActionRateLimiter, c.updateSettings);

router.get("/logs", requireAdminAuth, coursesReadRateLimiter,   c.getLogs);

router.post("/maintenance/enable",  requireAdminAuth, adminUserActionRateLimiter, c.enableMaintenance);
router.post("/maintenance/disable", requireAdminAuth, adminUserActionRateLimiter, c.disableMaintenance);

router.post("/test-email", requireAdminAuth, adminUserActionRateLimiter, c.testEmail);

router.post("/backup",  requireAdminAuth, adminUserActionRateLimiter, c.backup);
router.post("/restore", requireAdminAuth, adminUserActionRateLimiter, c.restore);

router.get("/storage-usage", requireAdminAuth, coursesReadRateLimiter, c.storageUsage);

router.post("/branding/sign",    requireAdminAuth, adminUserActionRateLimiter, c.signBranding);
router.post("/branding/confirm", requireAdminAuth, adminUserActionRateLimiter, c.confirmBranding);

module.exports = router;
