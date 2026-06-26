const express = require("express");
const { requireAdminAuth } = require("../middlewares/auth.middleware");
const { adminUserActionRateLimiter } = require("../middlewares/rateLimit.middleware");
const {
  getAssignmentStats, listAssignments, createAssignment,
  updateAssignment, deleteAssignment,
} = require("../controllers/userRoleAssignments.controller");

const router = express.Router();

// Static path BEFORE "/:id" so "stats" isn't treated as an id.
router.get("/stats", requireAdminAuth, getAssignmentStats);

router.get("/",  requireAdminAuth, listAssignments);
router.post("/", requireAdminAuth, adminUserActionRateLimiter, createAssignment);

router.patch("/:id",  requireAdminAuth, adminUserActionRateLimiter, updateAssignment);
router.delete("/:id", requireAdminAuth, adminUserActionRateLimiter, deleteAssignment);

module.exports = router;
