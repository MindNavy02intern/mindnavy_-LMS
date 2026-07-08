const express = require("express");

const {
  adminLoginController,
  adminMeController,
  adminLogoutController,
  adminSendOtpController,
  adminVerifyOtpController,
  adminGetTrustedDevicesController,
  adminRevokeTrustedDeviceController,
  adminForgotPasswordController,
  adminResetPasswordController,

} = require("../controllers/admin.controller");

const { requireAdminAuth } = require("../middlewares/auth.middleware");
const { adminLoginRateLimiter, otpRequestRateLimiter } = require("../middlewares/rateLimit.middleware");

const router = express.Router();

router.post("/login", adminLoginRateLimiter, adminLoginController);
router.get("/me", requireAdminAuth, adminMeController);
router.post("/logout", requireAdminAuth, adminLogoutController);

router.post("/otp/send", requireAdminAuth, otpRequestRateLimiter, adminSendOtpController);
router.post("/otp/verify", requireAdminAuth, adminVerifyOtpController);

router.get(
  "/trusted-devices",
  requireAdminAuth,
  adminGetTrustedDevicesController
);

router.delete(
  "/trusted-devices/:deviceId",
  requireAdminAuth,
  adminRevokeTrustedDeviceController
);

router.post("/forgot-password", adminLoginRateLimiter, adminForgotPasswordController);
router.post("/reset-password", adminLoginRateLimiter, adminResetPasswordController);

module.exports = router;