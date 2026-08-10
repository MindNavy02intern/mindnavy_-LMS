const express = require("express");

const { requireAdminAuth } = require("../middlewares/auth.middleware");
const {
  adminUserActionRateLimiter,
  adminUsersAnalyticsRateLimiter,
  coursesReadRateLimiter,
} = require("../middlewares/rateLimit.middleware");
// Reused as-is from the Users module — generic multer memoryStorage + CSV
// filter + 1MB limit, nothing user-specific despite the name.
const { uploadUsersCsv } = require("../middlewares/upload.middleware");
const c = require("../controllers/competencies.controller");

// Mounted at /api/admin/competencies (see server.js).
//
// Part 1: Skills CRUD + course mapping, module-wide Stats + Analytics. Part 2
// (Frameworks, Categories, User Skill Profiles, Assessments, Skill Gaps) adds
// routes here alongside its own controller handlers — same file, not a
// second router. Every sub-resource lives under its own prefix (/skills,
// /frameworks, /categories, ...) so there is no bare top-level "/:id" that
// "/stats"/"/analytics" could ever collide with.
const router = express.Router();

// ── Module-wide reads ────────────────────────────────────────────────────────
router.get("/stats",     requireAdminAuth, adminUsersAnalyticsRateLimiter, c.getStats);
router.get("/analytics", requireAdminAuth, adminUsersAnalyticsRateLimiter, c.getAnalytics);

// ── Skills — reads ───────────────────────────────────────────────────────────
router.get("/skills",     requireAdminAuth, coursesReadRateLimiter, c.listSkills);

// Registered BEFORE /skills/:id — "export" must never be read as a skill id
// (same ordering rule as /stats and /analytics above).
router.get("/skills/export",  requireAdminAuth, coursesReadRateLimiter, c.exportSkills);
router.post("/skills/import", requireAdminAuth, adminUserActionRateLimiter, uploadUsersCsv, c.importSkills);

router.get("/skills/:id", requireAdminAuth, coursesReadRateLimiter, c.getSkill);

// ── Skills — writes ──────────────────────────────────────────────────────────
router.post("/skills",       requireAdminAuth, adminUserActionRateLimiter, c.createSkill);
router.patch("/skills/:id",  requireAdminAuth, adminUserActionRateLimiter, c.updateSkill);
router.delete("/skills/:id", requireAdminAuth, adminUserActionRateLimiter, c.deleteSkill);

router.post("/skills/:id/assign-course",       requireAdminAuth, adminUserActionRateLimiter, c.assignCourse);
router.delete("/skills/:id/courses/:courseId", requireAdminAuth, adminUserActionRateLimiter, c.removeCourse);

// ── Frameworks (Part 2) ──────────────────────────────────────────────────────
router.get("/frameworks",     requireAdminAuth, coursesReadRateLimiter, c.listFrameworks);
router.get("/frameworks/:id", requireAdminAuth, coursesReadRateLimiter, c.getFramework);
router.post("/frameworks",       requireAdminAuth, adminUserActionRateLimiter, c.createFramework);
router.patch("/frameworks/:id",  requireAdminAuth, adminUserActionRateLimiter, c.updateFramework);
router.delete("/frameworks/:id", requireAdminAuth, adminUserActionRateLimiter, c.deleteFramework);
router.post("/frameworks/:id/skills",              requireAdminAuth, adminUserActionRateLimiter, c.addFrameworkSkill);
router.delete("/frameworks/:id/skills/:skillId",   requireAdminAuth, adminUserActionRateLimiter, c.removeFrameworkSkill);

// ── Skill categories (Part 2) ────────────────────────────────────────────────
router.get("/categories",        requireAdminAuth, coursesReadRateLimiter, c.listCategories);
router.post("/categories",       requireAdminAuth, adminUserActionRateLimiter, c.createCategory);
router.patch("/categories/:id",  requireAdminAuth, adminUserActionRateLimiter, c.updateCategory);
router.delete("/categories/:id", requireAdminAuth, adminUserActionRateLimiter, c.deleteCategory);

// ── User skill profiles (Part 2) ─────────────────────────────────────────────
router.get("/users/:userId/skills", requireAdminAuth, coursesReadRateLimiter, c.getUserSkills);

// ── Assessments (Part 2) ─────────────────────────────────────────────────────
router.get("/assessments",  requireAdminAuth, coursesReadRateLimiter, c.listAssessments);
router.post("/assessments", requireAdminAuth, adminUserActionRateLimiter, c.createAssessment);

// ── Skill gaps (Part 2) — analytical aggregate, same limiter as /stats and
// /analytics above (not the light list-read limiter).
router.get("/skill-gaps", requireAdminAuth, adminUsersAnalyticsRateLimiter, c.getSkillGaps);

// ── Competency Settings (Settings tab) — single row, mirrors
// /hierarchy/settings (organization.routes). ──────────────────────────────
router.get("/settings",   requireAdminAuth, coursesReadRateLimiter, c.getCompetencySettings);
router.patch("/settings", requireAdminAuth, adminUserActionRateLimiter, c.updateCompetencySettings);

module.exports = router;
