const express = require("express");

const {
  adminLoginController,
  adminMeController,
  adminLogoutController,
  adminSendOtpController,
  adminVerifyOtpController,
  adminCheckDeviceController,
  adminGetTrustedDevicesController,
  adminRevokeTrustedDeviceController,
  adminForgotPasswordController,
  adminResetPasswordController,
  adminUpdateProfileController,
  adminChangePasswordController,

} = require("../controllers/admin.controller");

const { requireAdminAuth } = require("../middlewares/auth.middleware");
const { adminLoginRateLimiter, otpRequestRateLimiter } = require("../middlewares/rateLimit.middleware");

const router = express.Router();

router.post("/login", adminLoginRateLimiter, adminLoginController);
router.get("/me", requireAdminAuth, adminMeController);
router.patch("/me", requireAdminAuth, adminUpdateProfileController);
router.post("/logout", requireAdminAuth, adminLogoutController);

// Reuses the login limiter — same "few attempts per window" shape, and
// avoids a one-off limiter definition for a single low-traffic endpoint.
router.post("/change-password", requireAdminAuth, adminLoginRateLimiter, adminChangePasswordController);

router.post("/otp/send", requireAdminAuth, otpRequestRateLimiter, adminSendOtpController);
router.post("/otp/verify", requireAdminAuth, adminVerifyOtpController);

// Called right after login (LoginPage) to decide whether to route the admin
// to /verify-device before the dashboard. Real path is /api/admin/devices/check
// — the "/api/devices/check" mentioned in old frontend TODO comments was
// aspirational shorthand, same as those comments' "/api/auth/otp/*" (the real
// otp routes above have always lived under /api/admin too).
router.get("/devices/check", requireAdminAuth, adminCheckDeviceController);

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