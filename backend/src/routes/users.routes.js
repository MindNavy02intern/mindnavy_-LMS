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
  exportUsers,
  getUserDetails,
  createUser,
  updateUser,
  updateUserStatus,
  suspendUser,
  reactivateUser,
  approveVerification,
  resetUserPassword,
  assignUserRole,
  deleteUser,
  getUsersAnalytics,
  importUsers,
  bulkActionUsers,
} = require("../controllers/users.controller");

const router = express.Router();



router.get("/", requireAdminAuth, getUsersList);

// Export route BEFORE /:id — "export" must not be treated as a user id
router.get("/export", requireAdminAuth, exportUsers);

router.get(
  "/analytics",
  requireAdminAuth,
  adminUsersAnalyticsRateLimiter,
  getUsersAnalytics
);

// Bulk-action BEFORE /:id — "bulk-action" must not be treated as a user id
router.post("/bulk-action",  requireAdminAuth, adminUserActionRateLimiter,  bulkActionUsers);


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

router.patch(
  "/:id/approve-verification",
  requireAdminAuth,
  adminUserActionRateLimiter,
  approveVerification
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
