const express = require("express");

const { requireAdminAuth } = require("../middlewares/auth.middleware");
const {
  adminUserActionRateLimiter,
  adminUsersAnalyticsRateLimiter,
  coursesReadRateLimiter,
} = require("../middlewares/rateLimit.middleware");
const c = require("../controllers/learners.controller");
const docs = require("../controllers/learnerDocuments.controller");
const tickets = require("../controllers/learnerTickets.controller");

// Mounted at /api/admin/learners (see server.js).
//
// `:id` is the AppUser id — the same value stored in Course/CourseEnrollment/
// Certificate userId fields, so one identifier links this module to Learning
// Management. Mirrors instructors.routes exactly (route ordering, limiter
// choices, everything).
//
// Parts 1/3/5/7 all mounted here: core CRUD, enrollments/progress/activity,
// assessments/certificates/attendance, documents/tickets.
const router = express.Router();

// ── Reads ──────────────────────────────────────────────────────────────────────
// /stats and /analytics MUST stay above /:id, or they are matched as learner
// ids (same ordering rule as instructors.routes / users.routes /export).
router.get("/stats",     requireAdminAuth, adminUsersAnalyticsRateLimiter, c.getStats);
router.get("/analytics", requireAdminAuth, adminUsersAnalyticsRateLimiter, c.getAnalytics);
router.get("/",          requireAdminAuth, coursesReadRateLimiter, c.listLearners);
router.get("/:id",       requireAdminAuth, coursesReadRateLimiter, c.getLearner);

// Two-segment paths, sit below /:id without being shadowed by it — Express
// matches "/:id" only against a single segment.
router.get("/:id/suspension-history", requireAdminAuth, coursesReadRateLimiter, c.getSuspensionHistory);
router.get("/:id/enrollments",        requireAdminAuth, coursesReadRateLimiter, c.listEnrollments);
router.get("/:id/progress",           requireAdminAuth, coursesReadRateLimiter, c.getProgress);
router.get("/:id/activity",           requireAdminAuth, coursesReadRateLimiter, c.getActivity);
router.get("/:id/assessments",        requireAdminAuth, coursesReadRateLimiter, c.listAssessments);
router.get("/:id/certificates",       requireAdminAuth, coursesReadRateLimiter, c.listCertificates);
router.get("/:id/attendance",         requireAdminAuth, coursesReadRateLimiter, c.getAttendance);
router.get("/:id/documents",          requireAdminAuth, coursesReadRateLimiter, docs.listDocuments);
router.get("/:id/tickets",            requireAdminAuth, coursesReadRateLimiter, tickets.listTickets);

// ── Writes ─────────────────────────────────────────────────────────────────────
router.post("/", requireAdminAuth, adminUserActionRateLimiter, c.createLearner);

// Literal single-segment path, method POST — no /:id route uses POST, so this
// can never be shadowed by (or shadow) the learner-id routes regardless of
// registration order; kept here for readability alongside the other writes.
router.post("/bulk-enroll", requireAdminAuth, adminUserActionRateLimiter, c.bulkEnroll);

// State transitions delegate to users.service (it owns AppUser.status /
// verificationState / passwordHash) — these routes exist so the Learners
// screen has its own verbs, not so any field gets a second writer.
router.patch("/:id/suspend",        requireAdminAuth, adminUserActionRateLimiter, c.suspendLearner);
router.patch("/:id/reactivate",     requireAdminAuth, adminUserActionRateLimiter, c.reactivateLearner);
router.patch("/:id/reset-password", requireAdminAuth, adminUserActionRateLimiter, c.resetPassword);

// Enrollments (Part 3) — thin wrappers over enrollments.service, see
// ENROLLMENTS_CONTRACT.md addendum. Two/three-segment, sit above the bare
// /:id writes below for the same shadowing reason as the reads above.
router.post("/:id/enrollments",   requireAdminAuth, adminUserActionRateLimiter, c.createEnrollment);
router.delete("/:id/enrollments/:enrollmentId", requireAdminAuth, adminUserActionRateLimiter, c.deleteEnrollment);
router.post("/:id/progress/:courseId/reset",    requireAdminAuth, adminUserActionRateLimiter, c.resetProgress);

// Assessments (Part 5) — QuizAttempt, admin-facing half of a runtime with no
// learner-facing half yet (see the model comment in learners.prisma).
router.post("/:id/assessments/:aid/reopen", requireAdminAuth, adminUserActionRateLimiter, c.reopenAssessment);
router.post("/:id/assessments/:aid/reset",  requireAdminAuth, adminUserActionRateLimiter, c.resetAssessment);
router.patch("/:id/assessments/:aid/grade", requireAdminAuth, adminUserActionRateLimiter, c.gradeAssessment);

// Certificates (Part 5) — thin wrappers over certificates.service, see
// CERTIFICATES_CONTRACT.md addendum.
router.post("/:id/certificates/:cid/reissue", requireAdminAuth, adminUserActionRateLimiter, c.reissueCertificate);
router.post("/:id/certificates/:cid/revoke",  requireAdminAuth, adminUserActionRateLimiter, c.revokeCertificate);

// Documents (Part 7) — same sign→PUT→confirm pattern as instructor documents;
// see learners.prisma LearnerDocument for the bucket-reuse note.
router.post("/:id/documents/sign",    requireAdminAuth, adminUserActionRateLimiter, docs.signUpload);
router.post("/:id/documents/confirm", requireAdminAuth, adminUserActionRateLimiter, docs.confirmUpload);
router.patch("/:id/documents/:docId/verify", requireAdminAuth, adminUserActionRateLimiter, docs.verifyDocument);
router.patch("/:id/documents/:docId/reject", requireAdminAuth, adminUserActionRateLimiter, docs.rejectDocument);
router.delete("/:id/documents/:docId", requireAdminAuth, adminUserActionRateLimiter, docs.archiveDocument);

// Tickets (Part 7) — no create endpoint, see learnerTickets.validator's header note.
router.patch("/:id/tickets/:tid/respond",  requireAdminAuth, adminUserActionRateLimiter, tickets.respond);
router.patch("/:id/tickets/:tid/resolve",  requireAdminAuth, adminUserActionRateLimiter, tickets.resolve);
router.patch("/:id/tickets/:tid/escalate", requireAdminAuth, adminUserActionRateLimiter, tickets.escalate);

router.patch("/:id",  requireAdminAuth, adminUserActionRateLimiter, c.updateLearner);
router.delete("/:id", requireAdminAuth, adminUserActionRateLimiter, c.deleteLearner);

module.exports = router;
