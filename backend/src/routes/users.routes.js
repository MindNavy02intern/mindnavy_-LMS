const express = require("express");

const { requireAdminAuth } = require("../middlewares/auth.middleware");

const {
  adminUserActionRateLimiter,
  adminUsersAnalyticsRateLimiter,
  adminUsersImportRateLimiter,
} = require("../middlewares/rateLimit.middleware");

const { uploadUsersCsv } = require("../middlewares/upload.middleware");

const {
  getUsersList,
  getUserDetails,
  createUser,
  updateUser,
  updateUserStatus,
  suspendUser,
  reactivateUser,
  resetUserPassword,
  assignUserRole,
  deleteUser,
  getUsersAnalytics,
  importUsers,
} = require("../controllers/users.controller");

const router = express.Router();



router.get("/", requireAdminAuth, getUsersList);

router.get(
  "/analytics",
  requireAdminAuth,
  adminUsersAnalyticsRateLimiter,
  getUsersAnalytics
);



router.post(
  "/import",
  requireAdminAuth,
  adminUsersImportRateLimiter,
  uploadUsersCsv,
  importUsers
);


router.post(
  "/",
  requireAdminAuth,
  adminUserActionRateLimiter,
  createUser
);



router.patch(
  "/:id/status",
  requireAdminAuth,
  adminUserActionRateLimiter,
  updateUserStatus
);

router.patch(
  "/:id/suspend",
  requireAdminAuth,
  adminUserActionRateLimiter,
  suspendUser
);

router.patch(
  "/:id/reactivate",
  requireAdminAuth,
  adminUserActionRateLimiter,
  reactivateUser
);

router.post(
  "/:id/reset-password",
  requireAdminAuth,
  adminUserActionRateLimiter,
  resetUserPassword
);

router.patch(
  "/:id/role",
  requireAdminAuth,
  adminUserActionRateLimiter,
  assignUserRole
);


router.get(
  "/:id",
  requireAdminAuth,
  getUserDetails
);

router.patch(
  "/:id",
  requireAdminAuth,
  adminUserActionRateLimiter,
  updateUser
);

router.delete(
  "/:id",
  requireAdminAuth,
  adminUserActionRateLimiter,
  deleteUser
);

module.exports = router;
