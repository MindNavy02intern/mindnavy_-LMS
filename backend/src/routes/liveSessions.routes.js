const express = require("express");

const { requireAdminAuth } = require("../middlewares/auth.middleware");
const {
  adminUserActionRateLimiter,
  coursesReadRateLimiter,
} = require("../middlewares/rateLimit.middleware");
const c = require("../controllers/liveSessions.controller");

// Mounted at /api/admin/live-sessions (see server.js) — scheduling CRUD, same
// shape as quizzes. The LM Overview keeps its own read at /api/admin/lm/live-sessions.
const router = express.Router();

// ── Reads ──────────────────────────────────────────────────────────────────────
router.get("/",    requireAdminAuth, coursesReadRateLimiter, c.listSessions);
router.get("/:id", requireAdminAuth, coursesReadRateLimiter, c.getSession);

// ── Writes (each create/update talks to the Zoom API) ──────────────────────────
router.post("/",      requireAdminAuth, adminUserActionRateLimiter, c.createSession);
router.patch("/:id",     requireAdminAuth, adminUserActionRateLimiter, c.updateSession);
router.patch("/:id/end", requireAdminAuth, adminUserActionRateLimiter, c.endSession);
router.patch("/:id/attendance", requireAdminAuth, adminUserActionRateLimiter, c.markAttendance);
router.delete("/:id",    requireAdminAuth, adminUserActionRateLimiter, c.deleteSession);

module.exports = router;
