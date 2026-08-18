const express = require("express");
const { requireAdminAuth } = require("../middlewares/auth.middleware");
const { adminLoginRateLimiter, adminUserActionRateLimiter } = require("../middlewares/rateLimit.middleware");
const c = require("../controllers/mfa.controller");

// Mounted at /api/admin/auth/mfa (see server.js).
const router = express.Router();

router.post("/setup",   requireAdminAuth, adminUserActionRateLimiter, c.setup);
router.post("/verify",  requireAdminAuth, adminUserActionRateLimiter, c.verify);
router.post("/disable", requireAdminAuth, adminUserActionRateLimiter, c.disable);

// Login-time challenge — deliberately NOT behind requireAdminAuth (see
// mfa.controller.js's loginVerify comment). Same rate limiter as /login
// since it's the same brute-force surface.
router.post("/login-verify", adminLoginRateLimiter, c.loginVerify);

module.exports = router;
