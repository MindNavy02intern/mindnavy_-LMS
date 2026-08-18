const rateLimit = require("express-rate-limit");

// PRODUCTION IS UNCHANGED at 20/15min. Dev is raised because Playwright's
// auth.setup.ts logs in once per full `npx playwright test` invocation, and
// the suite gets re-run many times in a single dev session (iterating on
// fixes) — 20 logins per 15 minutes is easy to exhaust that way, and a 429
// here takes down every single test in the run (nothing gets past auth
// setup), not just one. Same dev-only carve-out as the limiters below.
const adminLoginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV !== "production" ? 200 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login requests. Please try again later.",
  },
});

// Stricter limiter for write operations on user management endpoints.
//
// PRODUCTION IS UNCHANGED at 60/10min. The dev ceiling is raised because the
// module smoke suites now perform well over 60 writes in a single run (create →
// suspend → reactivate → verify → submit → approve → unpublish → upload →
// verify → archive → cleanup) and would otherwise fail on 429 partway through,
// hiding real regressions behind a rate limit. Same dev-only carve-out, and the
// same reasoning, as adminUsersAnalyticsRateLimiter below.
const adminUserActionRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: process.env.NODE_ENV !== "production" ? 600 : 60,
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
// so 30/min is exhausted in 2 reloads.
//
// PRODUCTION IS UNCHANGED at 30/min. Dev is raised further than that alone
// requires because this limiter guards every /lm/* route (see lm.routes.js
// router.use), and CoursesTab's own filter dropdown hits /lm/filter-options
// too — so courses-tab.full.spec.ts and lm-overview.full.spec.ts running
// back to back in the same suite (courses-tab.full + lm-overview.full +
// content-library.full, ~40 tests, each LM Overview load firing ~18
// requests) blew through 300/min well before either file finished, 429ing
// ContentStats/KpiCards/CoursesTable into their error states with no real
// bug behind it. Matches coursesReadRateLimiter's dev ceiling below.
const adminUsersAnalyticsRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: process.env.NODE_ENV !== "production" ? 1200 : 30,
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
//
// PRODUCTION IS UNCHANGED at 120/min. Dev is raised because this single
// limiter is wired into nearly every GET route in the admin API (courses,
// competencies, certificates, enrollments, categories, finance, instructors,
// integrations, learners, learning paths, notifications, quizzes, settings —
// see rateLimit.middleware usage across src/routes/*.js), so it's the
// combined read ceiling for the ENTIRE app, not just one page. A full
// Playwright run makes far more than 120 GETs/minute across ~50 spec files
// run back to back; without headroom here, list/detail fetches across
// unrelated features start failing well before the test volume is unusual
// for real interactive use. Same dev-only carve-out as the limiters above.
const coursesReadRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: process.env.NODE_ENV !== "production" ? 1200 : 120,
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
  // instructor-applications.full.spec.ts submits several applications per
  // run (pending/approve/reject/request-changes tests) — 5/hr is fine
  // anti-abuse in prod but 429s the suite well before it finishes.
  limit: process.env.NODE_ENV !== "production" ? 100 : 5,
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