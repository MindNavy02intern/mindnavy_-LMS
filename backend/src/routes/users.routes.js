const express = require("express");

const { requireAdminAuth } = require("../middlewares/auth.middleware");

const {
  adminUserActionRateLimiter,
  adminUsersAnalyticsRateLimiter,
  adminUsersImportRateLimiter,
  coursesReadRateLimiter,
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
  rejectVerification,
  resetUserPassword,
  assignUserRole,
  deleteUser,
  permanentDeleteUser,
  getUsersAnalytics,
  importUsers,
  bulkActionUsers,
  sendMessage,
  getUserMessagesList,
  forceLogoutUser,
  getUserCourses,
  unenrollUserCourse,
  getUserSessions,
  revokeUserSession,
  getUserNotes,
  addUserNote,
  deleteUserNote,
  exportUserData,
  requestUserDeletion,
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

router.patch(
  "/:id/reject-verification",
  requireAdminAuth,
  adminUserActionRateLimiter,
  rejectVerification
);

router.delete(
  "/:id/permanent",
  requireAdminAuth,
  adminUserActionRateLimiter,
  permanentDeleteUser
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


router.post(
  "/:id/force-logout",
  requireAdminAuth,
  adminUserActionRateLimiter,
  forceLogoutUser
);

// Messages sub-routes BEFORE generic /:id
router.post(
  "/:id/messages",
  requireAdminAuth,
  adminUserActionRateLimiter,
  sendMessage
);

router.get(
  "/:id/messages",
  requireAdminAuth,
  getUserMessagesList
);

// User Details Drawer sub-routes — all BEFORE generic /:id, same rule as
// /messages above ("courses"/"sessions"/"notes"/"export"/"request-deletion"
// must never be read as a user id).
router.get("/:id/courses", requireAdminAuth, coursesReadRateLimiter, getUserCourses);
router.delete("/:id/courses/:enrollmentId", requireAdminAuth, adminUserActionRateLimiter, unenrollUserCourse);

router.get("/:id/sessions", requireAdminAuth, coursesReadRateLimiter, getUserSessions);
router.delete("/:id/sessions/:sessionId", requireAdminAuth, adminUserActionRateLimiter, revokeUserSession);

router.get("/:id/notes", requireAdminAuth, coursesReadRateLimiter, getUserNotes);
router.post("/:id/notes", requireAdminAuth, adminUserActionRateLimiter, addUserNote);
router.delete("/:id/notes/:noteId", requireAdminAuth, adminUserActionRateLimiter, deleteUserNote);

router.get("/:id/export", requireAdminAuth, adminUsersAnalyticsRateLimiter, exportUserData);
router.post("/:id/request-deletion", requireAdminAuth, adminUserActionRateLimiter, requestUserDeletion);

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
