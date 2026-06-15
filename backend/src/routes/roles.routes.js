const express = require("express");
const { requireAdminAuth } = require("../middlewares/auth.middleware");
const { adminUserActionRateLimiter } = require("../middlewares/rateLimit.middleware");
const {
  listRoles, getRole, createRole, updateRole, deleteRole,
  getRolePermissions, assignPermissionsToRole,
} = require("../controllers/roles.controller");

const router = express.Router();

router.get("/",    requireAdminAuth, listRoles);
router.post("/",   requireAdminAuth, adminUserActionRateLimiter, createRole);

// /:id/permissions BEFORE /:id so "permissions" isn't treated as an id
router.get("/:id/permissions",  requireAdminAuth, getRolePermissions);
router.post("/:id/permissions", requireAdminAuth, adminUserActionRateLimiter, assignPermissionsToRole);

router.get("/:id",    requireAdminAuth, getRole);
router.patch("/:id",  requireAdminAuth, adminUserActionRateLimiter, updateRole);
router.delete("/:id", requireAdminAuth, adminUserActionRateLimiter, deleteRole);

module.exports = router;
