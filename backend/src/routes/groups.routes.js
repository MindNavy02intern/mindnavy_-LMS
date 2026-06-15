const express = require("express");
const { requireAdminAuth } = require("../middlewares/auth.middleware");
const { adminUserActionRateLimiter } = require("../middlewares/rateLimit.middleware");
const ctrl = require("../controllers/groups.controller");

const router = express.Router();

router.use(requireAdminAuth);

router.get(   "/",                          ctrl.listGroups);
router.post(  "/",    adminUserActionRateLimiter, ctrl.createGroup);
router.get(   "/:id",                       ctrl.getGroup);
router.patch( "/:id", adminUserActionRateLimiter, ctrl.updateGroup);
router.delete("/:id", adminUserActionRateLimiter, ctrl.deleteGroup);

router.get(   "/:id/members",                          ctrl.getGroupMembers);
router.post(  "/:id/members", adminUserActionRateLimiter, ctrl.addMembers);
router.delete("/:id/members/:userId", adminUserActionRateLimiter, ctrl.removeMember);

module.exports = router;
