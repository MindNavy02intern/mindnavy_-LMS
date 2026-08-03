const rateLimit = require("express-rate-limit");

const adminLoginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login requests. Please try again later.",
  },
});

// Stricter limiter for write operations on user management endpoints
const adminUserActionRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many user management requests. Please try again later.",
  },
});

// Analytics limiter — prevents heavy repeated aggregation queries.
// In development the LM Overview page fires 9+ requests on mount (each widget
// has its own useEffect) and React StrictMode doubles that to ~18 per load,
// so 30/min is exhausted in 2 reloads. Dev limit is raised to avoid 429 noise
// without touching production security.
const adminUsersAnalyticsRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: process.env.NODE_ENV !== "production" ? 300 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many analytics requests. Please try again later.",
  },
});

// Courses tab reads — higher ceiling than the analytics limiter because the
// table re-fetches on every tab / filter / search / page change. 120/min keeps
// interactive use smooth while still capping abuse.
const coursesReadRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please slow down and retry.",
  },
});

// OTP request limiter — codes live 5 minutes, so a real admin needs at most a
// couple per window; 10/15 min blocks OTP-spam without hurting legitimate use.
const otpRequestRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many OTP requests. Please try again later.",
  },
});

// Public certificate verification — the ONLY unauthenticated API surface (QR
// scans from phones, no login). Tight per-IP cap: legitimate use is a handful
// of scans; the 32-hex-char code space makes brute force pointless anyway, this
// just kills the noise.
const publicVerifyRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many verification requests. Please try again later.",
  },
});

// Public "Become Instructor" submissions — the second unauthenticated surface
// after certificate verification, and the only one that WRITES. A real person
// applies once; 5 per hour per IP leaves room for a retry after a validation
// error while making queue-flooding pointless. Paired with a honeypot field and
// a links-only payload (no file upload) in the applications validator.
const publicInstructorApplicationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many applications submitted. Please try again later.",
  },
});

// Import limiter — 5 imports per admin/IP per 10 minutes to prevent abuse
const adminUsersImportRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many import requests. Please try again later.",
  },
});

module.exports = {
  adminLoginRateLimiter,
  adminUserActionRateLimiter,
  adminUsersAnalyticsRateLimiter,
  adminUsersImportRateLimiter,
  coursesReadRateLimiter,
  otpRequestRateLimiter,
  publicVerifyRateLimiter,
  publicInstructorApplicationRateLimiter,
};