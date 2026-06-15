const express = require("express");
const { requireAdminAuth } = require("../middlewares/auth.middleware");
const { adminUserActionRateLimiter } = require("../middlewares/rateLimit.middleware");
const { list, send, resend, cancel, updateExpiration } = require("../controllers/invitations.controller");

const router = express.Router();

// GET  /api/admin/invitations        — list all invitations (with search, status filter, pagination)
router.get("/", requireAdminAuth, list);

// POST /api/admin/invitations        — send a new invitation
router.post("/", requireAdminAuth, adminUserActionRateLimiter, send);

// POST /api/admin/invitations/:id/resend     — resend invitation (resets expiresAt to +7 days)
router.post("/:id/resend", requireAdminAuth, adminUserActionRateLimiter, resend);

// DELETE /api/admin/invitations/:id          — cancel (set status REVOKED)
router.delete("/:id", requireAdminAuth, adminUserActionRateLimiter, cancel);

// PATCH /api/admin/invitations/:id/expiration — update expiry date
router.patch("/:id/expiration", requireAdminAuth, adminUserActionRateLimiter, updateExpiration);

module.exports = router;
