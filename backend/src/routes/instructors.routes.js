const express = require("express");

const { requireAdminAuth } = require("../middlewares/auth.middleware");
const {
  adminUserActionRateLimiter,
  adminUsersAnalyticsRateLimiter,
  coursesReadRateLimiter,
} = require("../middlewares/rateLimit.middleware");
const c = require("../controllers/instructors.controller");

// Mounted at /api/admin/instructors (see server.js).
//
// `:id` is the AppUser id — the same value stored in Course.instructorId and
// LiveSession.instructorId, so one identifier links all three modules.
const router = express.Router();

// ── Reads ──────────────────────────────────────────────────────────────────────
// /stats MUST stay above /:id, or "stats" is matched as an instructor id
// (same ordering rule as the /export route in users.routes).
router.get("/stats", requireAdminAuth, adminUsersAnalyticsRateLimiter, c.getStats);
router.get("/",      requireAdminAuth, coursesReadRateLimiter, c.listInstructors);
router.get("/:id",   requireAdminAuth, coursesReadRateLimiter, c.getInstructor);

// ── Writes ─────────────────────────────────────────────────────────────────────
router.post("/", requireAdminAuth, adminUserActionRateLimiter, c.createInstructor);

// State transitions delegate to users.service (it owns AppUser.status and
// verificationState) — these routes exist so the Instructors screen has its own
// verbs, not so the field gets a second writer.
router.patch("/:id/verify",     requireAdminAuth, adminUserActionRateLimiter, c.verifyInstructor);
router.patch("/:id/suspend",    requireAdminAuth, adminUserActionRateLimiter, c.suspendInstructor);
router.patch("/:id/reactivate", requireAdminAuth, adminUserActionRateLimiter, c.reactivateInstructor);

router.patch("/:id",  requireAdminAuth, adminUserActionRateLimiter, c.updateInstructor);
router.delete("/:id", requireAdminAuth, adminUserActionRateLimiter, c.deleteInstructor);

module.exports = router;
