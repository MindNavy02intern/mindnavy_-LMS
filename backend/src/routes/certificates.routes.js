const express = require("express");

const { requireAdminAuth } = require("../middlewares/auth.middleware");
const {
  adminUserActionRateLimiter,
  coursesReadRateLimiter,
} = require("../middlewares/rateLimit.middleware");
const c = require("../controllers/certificates.controller");

// Mounted at /api/admin/certificates (see server.js). The public QR verify
// endpoint is NOT here — it lives in publicCertificates.routes (no auth,
// /api/admin/* must stay 100% authenticated).
const router = express.Router();

// ── Reads ──────────────────────────────────────────────────────────────────────
router.get("/",        requireAdminAuth, coursesReadRateLimiter, c.listCertificates);
router.get("/:id/pdf", requireAdminAuth, coursesReadRateLimiter, c.downloadPdf);

// ── Writes ─────────────────────────────────────────────────────────────────────
router.post("/",             requireAdminAuth, adminUserActionRateLimiter, c.issueCertificate);
router.post("/:id/revoke",   requireAdminAuth, adminUserActionRateLimiter, c.revokeCertificate);
router.post("/:id/reissue",  requireAdminAuth, adminUserActionRateLimiter, c.reissueCertificate);

module.exports = router;
