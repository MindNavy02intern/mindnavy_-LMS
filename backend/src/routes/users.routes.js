const express = require("express");
const { requireAdminAuth } = require("../middlewares/auth.middleware");
const { adminUserActionRateLimiter } = require("../middlewares/rateLimit.middleware");
const {
  getUsersList,
  getUserDetails,
  createUser,
  updateUser,
  updateUserStatus,
  resetUserPassword,
  assignUserRole,
  deleteUser,
} = require("../controllers/users.controller");

const router = express.Router();

// ─── Read-only ────────────────────────────────────────────────────────────────
router.get("/", requireAdminAuth, getUsersList);
router.get("/:id", requireAdminAuth, getUserDetails);

// ─── Write (auth + strict rate limiter) ──────────────────────────────────────
// POST / must come before /:id routes to avoid shadowing
router.post("/", requireAdminAuth, adminUserActionRateLimiter, createUser);

// Sub-resource routes must come before bare /:id to avoid shadowing
router.patch("/:id/status", requireAdminAuth, adminUserActionRateLimiter, updateUserStatus);
router.post("/:id/reset-password", requireAdminAuth, adminUserActionRateLimiter, resetUserPassword);
router.patch("/:id/role", requireAdminAuth, adminUserActionRateLimiter, assignUserRole);

// General /:id routes last
router.patch("/:id", requireAdminAuth, adminUserActionRateLimiter, updateUser);
router.delete("/:id", requireAdminAuth, adminUserActionRateLimiter, deleteUser);

module.exports = router;
