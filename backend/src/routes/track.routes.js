const express = require("express");
const { publicVerifyRateLimiter } = require("../middlewares/rateLimit.middleware");
const { trackOpen, trackClick } = require("../controllers/track.controller");

// Mounted at /api/track (see server.js) — deliberately OUTSIDE /api/admin and
// without requireAdminAuth. These URLs are embedded in emails and opened by
// whatever mail client the recipient uses, which never carries an admin
// session token. Same per-IP rate limiter the other unauthenticated public
// routes use (publicCertificates.routes.js) — anyone can hit these ids.
const router = express.Router();

router.get("/open/:logId", publicVerifyRateLimiter, trackOpen);
router.get("/click/:logId", publicVerifyRateLimiter, trackClick);

module.exports = router;
