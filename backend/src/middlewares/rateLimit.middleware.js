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
};