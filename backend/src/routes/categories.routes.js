const express = require("express");

const { requireAdminAuth } = require("../middlewares/auth.middleware");
const {
  adminUserActionRateLimiter,
  coursesReadRateLimiter,
} = require("../middlewares/rateLimit.middleware");
const c = require("../controllers/categories.controller");

// Mounted at /api/admin/categories (see server.js).
const router = express.Router();

router.get("/", requireAdminAuth, coursesReadRateLimiter, c.listCategories);

router.post("/",      requireAdminAuth, adminUserActionRateLimiter, c.createCategory);
router.patch("/:id",  requireAdminAuth, adminUserActionRateLimiter, c.updateCategory);
router.delete("/:id", requireAdminAuth, adminUserActionRateLimiter, c.deleteCategory);

module.exports = router;
