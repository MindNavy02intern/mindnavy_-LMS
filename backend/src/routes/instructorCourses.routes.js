const express = require("express");

const c = require("../controllers/instructorCourses.controller");
const q = require("../controllers/instructorQuizzes.controller");
const { requireInstructorAuth } = require("../middlewares/instructorAuth.middleware");
const {
  coursesReadRateLimiter,
  adminUserActionRateLimiter,
} = require("../middlewares/rateLimit.middleware");

// Mounted at /api/instructor/courses (see server.js). No admin-only
// approve/reject/unpublish routes exist anywhere in this file — those stay
// exclusively on /api/admin/courses per the blueprint's explicit
// [ADMIN-ONLY] marker. Same reused rate limiters as instructorDashboard/
// instructorProfile routes (Phases 1-2) for consistency; a dedicated
// instructor-tier limiter is a scaling follow-up, not a security gap (IP-keyed
// either way).
const router = express.Router();

// ── Courses ───────────────────────────────────────────────────────────────────
router.get("/", requireInstructorAuth, coursesReadRateLimiter, c.listCourses);
router.get("/:id", requireInstructorAuth, coursesReadRateLimiter, c.getCourse);
router.post("/", requireInstructorAuth, adminUserActionRateLimiter, c.createCourse);
router.patch("/:id", requireInstructorAuth, adminUserActionRateLimiter, c.updateCourse);
router.delete("/:id", requireInstructorAuth, adminUserActionRateLimiter, c.archiveCourse);
router.post("/:id/restore", requireInstructorAuth, adminUserActionRateLimiter, c.restoreCourse);

// ── Workflow — settings / preview / submit ONLY. approve, reject, and
//    unpublish are intentionally absent: admin-only decisions per blueprint
//    Section 2.3 ("Approve, Reject, and Unpublish are intentionally NOT on
//    this page anywhere"). ─────────────────────────────────────────────────
router.patch("/:id/settings", requireInstructorAuth, adminUserActionRateLimiter, c.updateSettings);
router.get("/:id/preview", requireInstructorAuth, coursesReadRateLimiter, c.getPreview);
// Read-only "View" detail (Instructor Dashboard eye icon) — course + sections
// + full quiz question lists + enrollment stats/recent enrollments/reviews/
// trend in one call. Distinct from /preview above (the builder wizard's
// Preview step, course+sections only).
router.get("/:id/detail", requireInstructorAuth, coursesReadRateLimiter, c.getCourseDetail);
router.post("/:id/submit", requireInstructorAuth, adminUserActionRateLimiter, c.submitCourse);

// ── Sections ──────────────────────────────────────────────────────────────────
router.get("/:id/sections", requireInstructorAuth, coursesReadRateLimiter, c.listSections);
router.post("/:id/sections", requireInstructorAuth, adminUserActionRateLimiter, c.createSection);
router.patch("/:id/sections/:sectionId", requireInstructorAuth, adminUserActionRateLimiter, c.updateSection);
router.delete("/:id/sections/:sectionId", requireInstructorAuth, adminUserActionRateLimiter, c.deleteSection);

// ── Lessons ───────────────────────────────────────────────────────────────────
router.post("/:id/sections/:sectionId/lessons", requireInstructorAuth, adminUserActionRateLimiter, c.createLesson);
router.patch("/:id/sections/:sectionId/lessons/:lessonId", requireInstructorAuth, adminUserActionRateLimiter, c.updateLesson);
router.delete("/:id/sections/:sectionId/lessons/:lessonId", requireInstructorAuth, adminUserActionRateLimiter, c.deleteLesson);

// ── Uploads — same sign→PUT→confirm pattern as /api/admin/uploads, scoped to
//    the caller's own course. ─────────────────────────────────────────────────
router.post("/:id/uploads/sign", requireInstructorAuth, adminUserActionRateLimiter, c.signUpload);
router.post("/:id/uploads/confirm", requireInstructorAuth, adminUserActionRateLimiter, c.confirmUpload);
router.delete("/:id/uploads", requireInstructorAuth, adminUserActionRateLimiter, c.deleteUpload);

// ── Quizzes — reuses /api/admin/quizzes' service, self-scoped to a quiz
//    attached to one of the caller's own courses. ──────────────────────────────
router.get("/:id/quizzes", requireInstructorAuth, coursesReadRateLimiter, q.listQuizzes);
router.get("/:id/quizzes/:quizId", requireInstructorAuth, coursesReadRateLimiter, q.getQuiz);
router.post("/:id/quizzes", requireInstructorAuth, adminUserActionRateLimiter, q.createQuiz);
router.patch("/:id/quizzes/:quizId", requireInstructorAuth, adminUserActionRateLimiter, q.updateQuiz);
router.delete("/:id/quizzes/:quizId", requireInstructorAuth, adminUserActionRateLimiter, q.deleteQuiz);
router.post("/:id/quizzes/:quizId/questions", requireInstructorAuth, adminUserActionRateLimiter, q.createQuestion);
router.patch("/:id/quizzes/:quizId/questions/:questionId", requireInstructorAuth, adminUserActionRateLimiter, q.updateQuestion);
router.delete("/:id/quizzes/:quizId/questions/:questionId", requireInstructorAuth, adminUserActionRateLimiter, q.deleteQuestion);
router.patch("/:id/quizzes/:quizId/reorder", requireInstructorAuth, adminUserActionRateLimiter, q.reorderQuestions);

// ── Reorder ────────────────────────────────────────────────────────────────────
router.patch("/:id/reorder", requireInstructorAuth, adminUserActionRateLimiter, c.reorder);

module.exports = router;
