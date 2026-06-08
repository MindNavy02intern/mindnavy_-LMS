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
  resetUserPassword,
  assignUserRole,
  deleteUser,
  getUsersAnalytics,
  importUsers,
} = require("../controllers/users.controller");

const router = express.Router();

// ─── Read-only ────────────────────────────────────────────────────────────────
router.get("/", requireAdminAuth, getUsersList);
// Analytics must be registered before /:id to avoid Express treating "analytics" as an id
router.get("/analytics", requireAdminAuth, adminUsersAnalyticsRateLimiter, getUsersAnalytics);
router.get("/:id", requireAdminAuth, getUserDetails);

// ─── Write (auth + strict rate limiter) ──────────────────────────────────────
// POST / must come before /:id routes to avoid shadowing
router.post("/", requireAdminAuth, adminUserActionRateLimiter, createUser);

// Import route BEFORE /:id — "import" must not be treated as a user id
router.post("/import", requireAdminAuth, adminUsersImportRateLimiter, uploadUsersCsv, importUsers);

// Sub-resource routes must come before bare /:id to avoid shadowing
router.patch("/:id/status", requireAdminAuth, adminUserActionRateLimiter, updateUserStatus);
router.post("/:id/reset-password", requireAdminAuth, adminUserActionRateLimiter, resetUserPassword);
router.patch("/:id/role", requireAdminAuth, adminUserActionRateLimiter, assignUserRole);

// General /:id routes last
router.patch("/:id", requireAdminAuth, adminUserActionRateLimiter, updateUser);
router.delete("/:id", requireAdminAuth, adminUserActionRateLimiter, deleteUser);

module.exports = router;
