const express = require("express");
const { requireAdminAuth } = require("../middlewares/auth.middleware");
const { adminUserActionRateLimiter } = require("../middlewares/rateLimit.middleware");
const {
  listAccessPolicies, getAccessPolicyStats, getAccessPolicy,
  createAccessPolicy, updateAccessPolicy, deleteAccessPolicy,
} = require("../controllers/accessPolicies.controller");

const router = express.Router();

router.get("/",  requireAdminAuth, listAccessPolicies);
router.post("/", requireAdminAuth, adminUserActionRateLimiter, createAccessPolicy);

// Static path BEFORE "/:id" so "stats" isn't treated as an id.
router.get("/stats", requireAdminAuth, getAccessPolicyStats);

router.get("/:id",    requireAdminAuth, getAccessPolicy);
router.patch("/:id",  requireAdminAuth, adminUserActionRateLimiter, updateAccessPolicy);
router.delete("/:id", requireAdminAuth, adminUserActionRateLimiter, deleteAccessPolicy);

module.exports = router;
