const express = require("express");

const { publicInstructorApplicationRateLimiter } = require("../middlewares/rateLimit.middleware");
const c = require("../controllers/instructorApplications.controller");

// Mounted at /api/public/instructor-applications (see server.js).
//
// DELIBERATELY UNAUTHENTICATED — this is the public "Become Instructor" form
// (blueprint 05 §3); an applicant has no account yet, so there is nothing to
// log in with. It is also the only unauthenticated endpoint in the system that
// WRITES, so the defenses are stacked:
//   • POST only — there is no public read, no listing, no id lookup.
//   • Dedicated per-IP rate limiter (5/hour).
//   • Strict allow-list validator; every review/status field is rejected, so a
//     submission can never self-approve.
//   • Links only (http/https, URL-parsed) — no unauthenticated upload surface.
//   • Honeypot field, silently dropped.
//   • Uniform id-free 202 response — no way to probe which emails have applied.
const router = express.Router();

router.post("/", publicInstructorApplicationRateLimiter, c.submitApplication);

module.exports = router;
