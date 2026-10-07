const express = require("express");

const {
  adminLoginController,
  adminDeviceLoginSendOtpController,
  adminDeviceLoginVerifyController,
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

// New-device step of login. When /login answers { deviceVerificationRequired,
// verificationToken } there is NO session yet — these two calls are the only
// thing that ticket can do, so they're deliberately not behind
// requireAdminAuth (same as /auth/mfa/login-verify). Pre-auth, IP-keyed
// limiters: sending reuses the OTP-send limiter, verifying reuses the login
// limiter since it's the same brute-force surface.
router.post("/login/device/send-otp", otpRequestRateLimiter, adminDeviceLoginSendOtpController);
router.post("/login/device/verify", adminLoginRateLimiter, adminDeviceLoginVerifyController);

router.get("/me", requireAdminAuth, adminMeController);
router.patch("/me", requireAdminAuth, adminUpdateProfileController);
router.post("/logout", requireAdminAuth, adminLogoutController);

// Reuses the login limiter — same "few attempts per window" shape, and
// avoids a one-off limiter definition for a single low-traffic endpoint.
router.post("/change-password", requireAdminAuth, adminLoginRateLimiter, adminChangePasswordController);

router.post("/otp/send", requireAdminAuth, otpRequestRateLimiter, adminSendOtpController);
router.post("/otp/verify", requireAdminAuth, adminVerifyOtpController);

// Session-authenticated device check. No longer part of login (the server now
// decides that itself in admin.service.js finishLogin); kept for an already
// signed-in admin, alongside /otp/send + /otp/verify above, which
// TrustedDevicesPage uses to trust the current browser.
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