const express = require("express");

const {
  adminLoginController,
  adminMeController,
  adminLogoutController,
} = require("../controllers/admin.controller");

const { requireAdminAuth } = require("../middlewares/auth.middleware");

const router = express.Router();

router.post("/login", adminLoginController);
router.get("/me", requireAdminAuth, adminMeController);
router.post("/logout", requireAdminAuth, adminLogoutController);

module.exports = router;