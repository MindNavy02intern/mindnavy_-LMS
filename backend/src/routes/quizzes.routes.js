const express = require("express");

const { requireAdminAuth } = require("../middlewares/auth.middleware");
const {
  adminUserActionRateLimiter,
  coursesReadRateLimiter,
} = require("../middlewares/rateLimit.middleware");
const c = require("../controllers/quizzes.controller");

// Mounted at /api/admin/quizzes (see server.js) — own prefix, same shape as
// learning-paths. /:id/reorder is used (not /:id/questions/reorder) so the
// literal segment can never collide with the /:id/questions/:questionId param.
const router = express.Router();

// ── Reads ──────────────────────────────────────────────────────────────────────
router.get("/",    requireAdminAuth, coursesReadRateLimiter, c.listQuizzes);
router.get("/:id", requireAdminAuth, coursesReadRateLimiter, c.getQuiz);

// ── Quizzes (writes) ─────────────────────────────────────────────────────────────
router.post("/",      requireAdminAuth, adminUserActionRateLimiter, c.createQuiz);
router.patch("/:id",  requireAdminAuth, adminUserActionRateLimiter, c.updateQuiz);
router.delete("/:id", requireAdminAuth, adminUserActionRateLimiter, c.deleteQuiz);

// ── Questions (writes) ───────────────────────────────────────────────────────────
router.post("/:id/questions",                requireAdminAuth, adminUserActionRateLimiter, c.createQuestion);
router.patch("/:id/questions/:questionId",   requireAdminAuth, adminUserActionRateLimiter, c.updateQuestion);
router.delete("/:id/questions/:questionId",  requireAdminAuth, adminUserActionRateLimiter, c.deleteQuestion);

// ── Reorder (bulk write) ─────────────────────────────────────────────────────────
router.patch("/:id/reorder", requireAdminAuth, adminUserActionRateLimiter, c.reorderQuestions);

module.exports = router;
