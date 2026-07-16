const express = require("express");

const { publicVerifyRateLimiter } = require("../middlewares/rateLimit.middleware");
const c = require("../controllers/certificates.controller");

// Mounted at /api/public/certificates (see server.js).
//
// DELIBERATELY UNAUTHENTICATED — this is the QR-scan verification endpoint;
// anyone holding a certificate must be able to check it without a login.
// Defenses instead of auth: 32-hex-char crypto-random codes (unguessable),
// a dedicated per-IP rate limiter, format check before any DB hit, and a
// minimal response (name/course/date only — no ids, no email, no listing).
const router = express.Router();

router.get("/verify/:code", publicVerifyRateLimiter, c.verifyCertificate);

module.exports = router;
