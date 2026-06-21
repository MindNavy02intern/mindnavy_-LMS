const express = require("express");
const { requireAdminAuth } = require("../middlewares/auth.middleware");
const { adminUserActionRateLimiter } = require("../middlewares/rateLimit.middleware");
const {
  getPermissionMatrix, togglePermissionMatrixCell,
} = require("../controllers/roles.controller");

const router = express.Router();

// Read the full matrix (roles × permissions + assignments).
router.get("/", requireAdminAuth, getPermissionMatrix);

// Toggle a single cell on/off (rate-limited write).
router.post("/toggle", requireAdminAuth, adminUserActionRateLimiter, togglePermissionMatrixCell);

module.exports = router;
