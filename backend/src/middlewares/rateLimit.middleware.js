const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");

// ── Keying strategy ───────────────────────────────────────────────────────────
//
// Two families of limiter live in this file and they must NOT be keyed the same
// way:
//
//   • PRE-AUTH limiters (login, OTP, the two /api/public/* surfaces) have no
//     identity to key on yet — an attacker is precisely someone who hasn't
//     authenticated. These stay keyed by IP. That is the whole point of them.
//
//   • POST-AUTH limiters (every /api/admin/* read and write) run after
//     requireAdminAuth, so a real identity IS available. Keying those by IP was
//     a bug: express-rate-limit's IP key is shared by everyone behind the same
//     NAT, so two admins in one office — or every user behind a reverse proxy
//     when `trust proxy` isn't set — drew from a single bucket and 429'd each
//     other out of the app. They are now keyed per admin session instead.
//
// The session token is hashed rather than used raw: this store is a plain
// in-memory Map whose keys show up in heap dumps and debugger views, and a raw
// session token there is a credential sitting in the clear for no benefit. A
// truncated SHA-256 is a stable per-session key with none of that exposure.
function adminKeyGenerator(req, res) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (token) {
      return "s:" + crypto.createHash("sha256").update(token).digest("hex").slice(0, 32);
    }
  }
  // No token (or a malformed header): fall back to IP. ipKeyGenerator is
  // express-rate-limit's own helper — it normalises IPv6 into a /56 subnet so a
  // single client can't cycle through addresses in its own prefix to reset the
  // counter. Calling req.ip directly here would be an IPv6 bypass.
  return ipKeyGenerator(req.ip);
}

// ── Ceilings ──────────────────────────────────────────────────────────────────
//
// Production values below are sized for what this admin SPA actually does, not
// for a hand-wavy "feels safe" number. Measured behaviour: one page load fires
// 10–20 GETs (each widget/table/stat card fetches independently), and every
// mutation broadcasts a refresh event that makes several mounted components
// refetch — so a single click can cost another 5–12 GETs. An admin working
// normally therefore sits in the low hundreds of reads per minute, and the old
// 120/min ceiling was reached after roughly 6–10 page loads.
//
// These limiters are DoS protection, not authorisation: they sit behind
// requireAdminAuth on an API where the caller already has full admin read
// access. The job is to stop a runaway loop or a scripted scrape, which the
// values below still do comfortably.
const isProd = process.env.NODE_ENV === "production";

// Login attempts — pre-auth, IP-keyed, deliberately tight.
//
// PRODUCTION IS UNCHANGED at 20/15min. Dev is raised because Playwright's
// auth.setup.ts logs in once per full `npx playwright test` invocation, and
// the suite gets re-run many times in a single dev session (iterating on
// fixes) — 20 logins per 15 minutes is easy to exhaust that way, and a 429
// here takes down every single test in the run (nothing gets past auth
// setup), not just one.
const adminLoginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isProd ? 20 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login requests. Please try again later.",
  },
});

// Write operations on admin endpoints. Per-admin now, so one admin running a
// bulk operation can no longer lock out a colleague on the same network.
// 300/10min is far above interactive use (a fast admin clicking through forms
// manages maybe 30–60 writes in ten minutes) while still capping a runaway
// client loop.
const adminUserActionRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: isProd ? 300 : 600,
  keyGenerator: adminKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many user management requests. Please try again later.",
  },
});

// Analytics limiter — guards the heavier aggregation endpoints (every /lm/*
// route via lm.routes.js's router.use, plus the per-module /stats + /analytics
// pairs). The LM Overview page alone fires 9+ of these on mount, and React
// StrictMode doubles that in dev.
const adminUsersAnalyticsRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: isProd ? 300 : 1200,
  keyGenerator: adminKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many analytics requests. Please try again later.",
  },
});

// General admin reads. Despite the name this is wired into ~99 GET routes
// across 21 route files (courses, competencies, certificates, enrollments,
// categories, finance, instructors, integrations, learners, learning paths,
// notifications, quizzes, settings, users…) — it is the combined read ceiling
// for the ENTIRE admin API, not just the Courses tab. Sized accordingly: see
// the "Ceilings" note above for where 600 comes from.
const coursesReadRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: isProd ? 600 : 1200,
  keyGenerator: adminKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please slow down and retry.",
  },
});

// OTP request limiter — pre-auth (the admin is mid-login), so IP-keyed. Codes
// live 5 minutes, so a real admin needs at most a couple per window; 10/15 min
// blocks OTP-spam without hurting legitimate use.
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

// Public certificate verification — unauthenticated (QR scans from phones, no
// login), so necessarily IP-keyed. Tight per-IP cap: legitimate use is a
// handful of scans; the 32-hex-char code space makes brute force pointless
// anyway, this just kills the noise.
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
  limit: isProd ? 5 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many applications submitted. Please try again later.",
  },
});

// Import limiter — genuinely expensive (parses and inserts a whole CSV), so it
// stays tight even per-admin.
const adminUsersImportRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  keyGenerator: adminKeyGenerator,
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
