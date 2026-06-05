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

module.exports = {
  adminLoginRateLimiter,
  adminUserActionRateLimiter,
};