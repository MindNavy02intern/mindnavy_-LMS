const express = require("express");

const { requireAdminAuth } = require("../middlewares/auth.middleware");
const {
  adminUserActionRateLimiter,
  adminUsersAnalyticsRateLimiter,
  coursesReadRateLimiter,
} = require("../middlewares/rateLimit.middleware");
const c = require("../controllers/instructors.controller");
const docs = require("../controllers/instructorDocuments.controller");

// Mounted at /api/admin/instructors (see server.js).
//
// `:id` is the AppUser id — the same value stored in Course.instructorId and
// LiveSession.instructorId, so one identifier links all three modules.
const router = express.Router();

// ── Reads ──────────────────────────────────────────────────────────────────────
// /stats and /analytics MUST stay above /:id, or they are matched as instructor
// ids (same ordering rule as the /export route in users.routes). Both are
// aggregate reads, so both sit behind the analytics limiter.
router.get("/stats",     requireAdminAuth, adminUsersAnalyticsRateLimiter, c.getStats);
router.get("/analytics", requireAdminAuth, adminUsersAnalyticsRateLimiter, c.getAnalytics);
router.get("/",          requireAdminAuth, coursesReadRateLimiter, c.listInstructors);
router.get("/:id",       requireAdminAuth, coursesReadRateLimiter, c.getInstructor);

// Two-segment path, so it can sit below /:id without being shadowed by it —
// Express matches "/:id" only against a single segment.
router.get("/:id/suspension-history", requireAdminAuth, coursesReadRateLimiter, c.getSuspensionHistory);

// ── Writes ─────────────────────────────────────────────────────────────────────
router.post("/", requireAdminAuth, adminUserActionRateLimiter, c.createInstructor);

// State transitions delegate to users.service (it owns AppUser.status and
// verificationState) — these routes exist so the Instructors screen has its own
// verbs, not so the field gets a second writer.
router.patch("/:id/verify",     requireAdminAuth, adminUserActionRateLimiter, c.verifyInstructor);
router.patch("/:id/suspend",    requireAdminAuth, adminUserActionRateLimiter, c.suspendInstructor);
router.patch("/:id/reactivate", requireAdminAuth, adminUserActionRateLimiter, c.reactivateInstructor);

// ── Documents (blueprint 05 §12) ────────────────────────────────────────────────
// Administrative paperwork only — teaching certificates are a separate entity
// with their own tab (§11). Upload is sign → client PUT → confirm, the same flow
// as uploads.routes: the API never streams file bytes (express.json is capped at
// 50kb, and the only multer instance in the app is the CSV import).
//
// These sit ABOVE the bare /:id writes so a two-segment documents path is never
// considered by them.
router.get("/:id/documents",  requireAdminAuth, coursesReadRateLimiter, docs.listDocuments);
router.post("/:id/documents/sign",    requireAdminAuth, adminUserActionRateLimiter, docs.signUpload);
router.post("/:id/documents/confirm", requireAdminAuth, adminUserActionRateLimiter, docs.confirmUpload);
router.patch("/:id/documents/:docId/verify", requireAdminAuth, adminUserActionRateLimiter, docs.verifyDocument);
router.patch("/:id/documents/:docId/reject", requireAdminAuth, adminUserActionRateLimiter, docs.rejectDocument);
// Soft — archives the row, keeps the file (see the service).
router.delete("/:id/documents/:docId", requireAdminAuth, adminUserActionRateLimiter, docs.archiveDocument);

router.patch("/:id",  requireAdminAuth, adminUserActionRateLimiter, c.updateInstructor);
router.delete("/:id", requireAdminAuth, adminUserActionRateLimiter, c.deleteInstructor);

module.exports = router;
