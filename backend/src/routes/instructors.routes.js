const express = require("express");

const { requireAdminAuth } = require("../middlewares/auth.middleware");
const {
  adminUserActionRateLimiter,
  adminUsersAnalyticsRateLimiter,
  coursesReadRateLimiter,
} = require("../middlewares/rateLimit.middleware");
const c = require("../controllers/instructors.controller");
const docs = require("../controllers/instructorDocuments.controller");
const reviews = require("../controllers/instructorReviews.controller");
const certs = require("../controllers/instructorCertifications.controller");

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

// ── Reviews (moderation queue) ──────────────────────────────────────────────────
// NOT in INSTRUCTORS_CONTRACT.md v1 ("no Review model" is documented as a
// deliberate [planned] gap — decision for Hassan, not a bug). Shipped anyway at
// the user's explicit direction 2026-08-07; see instructors.prisma
// InstructorReview for the full note. Contract shape:
//
//   GET   /:id/reviews                       -> { reviews: Review[], pagination }
//   PATCH /:id/reviews/:reviewId/approve     -> Review (status: APPROVED)
//   PATCH /:id/reviews/:reviewId/remove      -> Review (status: REMOVED)
//   PATCH /:id/reviews/:reviewId/flag        -> Review (status: FLAGGED)
//
//   Review = { id, instructorId, studentId, studentName, courseId, courseTitle,
//              rating, comment, status, createdAt, updatedAt }
router.get("/:id/reviews", requireAdminAuth, coursesReadRateLimiter, reviews.listReviews);
router.patch("/:id/reviews/:reviewId/approve", requireAdminAuth, adminUserActionRateLimiter, reviews.approveReview);
router.patch("/:id/reviews/:reviewId/remove",  requireAdminAuth, adminUserActionRateLimiter, reviews.removeReview);
router.patch("/:id/reviews/:reviewId/flag",    requireAdminAuth, adminUserActionRateLimiter, reviews.flagReview);

// ── Certifications (teaching certs/licences — separate entity from Documents) ──
// NOT in INSTRUCTORS_CONTRACT.md v1 ("Certifications deliberately did NOT ship"
// is documented as a [planned] gap). Shipped anyway at the user's explicit
// direction 2026-08-07; see instructors.prisma InstructorCertification. Upload
// is sign -> client PUT -> create (same 3-step pattern as Documents — the API
// never receives file bytes). Contract shape:
//
//   GET    /:id/certifications                    -> { certifications: Certification[], total }
//   POST   /:id/certifications/sign                -> { uploadUrl, path, maxBytes, expiresIn }
//   POST   /:id/certifications                     -> Certification (body: { name, type, issuer, path?, fileName? })
//   PATCH  /:id/certifications/:certId/verify      -> Certification (status: VERIFIED)
//   PATCH  /:id/certifications/:certId/reject      -> Certification (status: REJECTED)
//   DELETE /:id/certifications/:certId             -> { id } (hard delete — no ARCHIVED status in this model)
//
//   Certification = { id, instructorId, name, type, issuer, fileUrl (signed,
//                     5-min expiry, never cached), status, createdAt, updatedAt,
//                     verifiedAt, verifiedById }
router.get("/:id/certifications",  requireAdminAuth, coursesReadRateLimiter, certs.listCertifications);
router.post("/:id/certifications/sign", requireAdminAuth, adminUserActionRateLimiter, certs.signUpload);
router.post("/:id/certifications", requireAdminAuth, adminUserActionRateLimiter, certs.createCertification);
router.patch("/:id/certifications/:certId/verify", requireAdminAuth, adminUserActionRateLimiter, certs.verifyCertification);
router.patch("/:id/certifications/:certId/reject", requireAdminAuth, adminUserActionRateLimiter, certs.rejectCertification);
router.delete("/:id/certifications/:certId", requireAdminAuth, adminUserActionRateLimiter, certs.deleteCertification);

router.patch("/:id",  requireAdminAuth, adminUserActionRateLimiter, c.updateInstructor);
router.delete("/:id", requireAdminAuth, adminUserActionRateLimiter, c.deleteInstructor);

module.exports = router;
