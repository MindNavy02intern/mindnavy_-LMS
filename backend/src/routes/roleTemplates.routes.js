const express = require("express");
const { requireAdminAuth } = require("../middlewares/auth.middleware");
const { adminUserActionRateLimiter } = require("../middlewares/rateLimit.middleware");
const {
  listRoleTemplates, getRoleTemplate, createRoleTemplate,
  applyRoleTemplate, deleteRoleTemplate,
} = require("../controllers/roleTemplates.controller");

const router = express.Router();

router.get("/",  requireAdminAuth, listRoleTemplates);
router.post("/", requireAdminAuth, adminUserActionRateLimiter, createRoleTemplate);

// /:id/apply BEFORE /:id so the sub-path isn't treated as an id.
router.post("/:id/apply", requireAdminAuth, adminUserActionRateLimiter, applyRoleTemplate);

router.get("/:id",    requireAdminAuth, getRoleTemplate);
router.delete("/:id", requireAdminAuth, adminUserActionRateLimiter, deleteRoleTemplate);

module.exports = router;
