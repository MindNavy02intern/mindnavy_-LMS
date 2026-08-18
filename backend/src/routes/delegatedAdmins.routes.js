const express = require("express");
const { requireAdminAuth } = require("../middlewares/auth.middleware");
const { adminUserActionRateLimiter } = require("../middlewares/rateLimit.middleware");
const {
  listDelegatedAdmins, getAdminDirectory, grantDelegatedAdmin, revokeDelegatedAdmin,
} = require("../controllers/delegatedAdmins.controller");

const router = express.Router();

router.get("/",           requireAdminAuth, listDelegatedAdmins);
router.get("/directory",  requireAdminAuth, getAdminDirectory);
router.post("/",          requireAdminAuth, adminUserActionRateLimiter, grantDelegatedAdmin);
router.post("/:id/revoke", requireAdminAuth, adminUserActionRateLimiter, revokeDelegatedAdmin);

module.exports = router;
