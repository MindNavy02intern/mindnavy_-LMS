const express = require("express");
const { requireAdminAuth } = require("../middlewares/auth.middleware");
const { adminUserActionRateLimiter } = require("../middlewares/rateLimit.middleware");
const {
  listPermissions, getPermission, createPermission, updatePermission, deletePermission,
} = require("../controllers/roles.controller");

const router = express.Router();

router.get("/",    requireAdminAuth, listPermissions);
router.post("/",   requireAdminAuth, adminUserActionRateLimiter, createPermission);
router.get("/:id",    requireAdminAuth, getPermission);
router.patch("/:id",  requireAdminAuth, adminUserActionRateLimiter, updatePermission);
router.delete("/:id", requireAdminAuth, adminUserActionRateLimiter, deletePermission);

module.exports = router;
