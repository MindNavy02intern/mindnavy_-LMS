const express = require("express");
const { requireAdminAuth } = require("../middlewares/auth.middleware");
const { adminUserActionRateLimiter } = require("../middlewares/rateLimit.middleware");
const {
  listCompanyRoles, getPermissionCatalog, getCompanyRole,
  createCompanyRole, updateCompanyRole, deleteCompanyRole,
} = require("../controllers/companyRoles.controller");

const router = express.Router();

router.get("/",             requireAdminAuth, listCompanyRoles);
router.get("/permissions",  requireAdminAuth, getPermissionCatalog);
router.post("/",            requireAdminAuth, adminUserActionRateLimiter, createCompanyRole);

router.get("/:id",    requireAdminAuth, getCompanyRole);
router.patch("/:id",  requireAdminAuth, adminUserActionRateLimiter, updateCompanyRole);
router.delete("/:id", requireAdminAuth, adminUserActionRateLimiter, deleteCompanyRole);

module.exports = router;
