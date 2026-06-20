const express = require("express");
const { requireAdminAuth } = require("../middlewares/auth.middleware");
const { adminUserActionRateLimiter } = require("../middlewares/rateLimit.middleware");
const {
  listRoles, getRolesStats, getRole, createRole, updateRole, deleteRole, duplicateRole,
  getRolePermissions, assignPermissionsToRole,
} = require("../controllers/roles.controller");

const router = express.Router();

router.get("/",    requireAdminAuth, listRoles);
router.post("/",   requireAdminAuth, adminUserActionRateLimiter, createRole);

// Static path BEFORE "/:id" so "stats" isn't treated as an id
router.get("/stats", requireAdminAuth, getRolesStats);

// /:id/permissions and /:id/duplicate BEFORE /:id so the sub-path isn't treated as an id
router.get("/:id/permissions",  requireAdminAuth, getRolePermissions);
router.post("/:id/permissions", requireAdminAuth, adminUserActionRateLimiter, assignPermissionsToRole);
router.post("/:id/duplicate",   requireAdminAuth, adminUserActionRateLimiter, duplicateRole);

router.get("/:id",    requireAdminAuth, getRole);
router.patch("/:id",  requireAdminAuth, adminUserActionRateLimiter, updateRole);
router.delete("/:id", requireAdminAuth, adminUserActionRateLimiter, deleteRole);

module.exports = router;
