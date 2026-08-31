const svc = require("../services/instructorReviews.service");

// Instructor self-service reviews (blueprint 2.6) — distinct file from
// instructorReviews.controller.js (the admin console's per-instructor
// moderation viewer, mounted under /api/admin/instructors/:id/reviews).
// This one is mounted at /api/instructor/reviews, auth'd via
// requireInstructorAuth, and is read-only: no approve/remove/flag here.

function badRequest(res, msg) {
  return res.status(400).json({ success: false, message: msg });
}

function notFound(res, msg = "Not found.") {
  return res.status(404).json({ success: false, message: msg });
}

function handleDomainError(res, err) {
  switch (err.code) {
    case "INSTRUCTOR_NOT_FOUND":
      return notFound(res, "Instructor not found.");
    default:
      return null;
  }
}

function serverError(res, err) {
  console.error("[InstructorReviewsSelfController]", err);
  if (err.code === "P2021" || err.code === "P2022") {
    return res.status(503).json({ success: false, message: "Database not migrated yet. Run `npx prisma db push`." });
  }
  return res.status(500).json({ success: false, message: "Internal server error." });
}

function run(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      return handleDomainError(res, err) ?? serverError(res, err);
    }
  };
}

const REVIEW_STATUSES = new Set(["PENDING", "APPROVED", "FLAGGED"]);

const listReviews = run(async (req, res) => {
  const { page, limit, status } = req.query;
  if (status !== undefined && !REVIEW_STATUSES.has(String(status).toUpperCase())) {
    return badRequest(res, "status must be one of: PENDING, APPROVED, FLAGGED.");
  }
  const result = await svc.listMyReviews(req.instructor.id, {
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    status: status ? String(status).toUpperCase() : undefined,
  });
  return res.json({ success: true, data: result });
});

const getStats = run(async (req, res) => {
  const result = await svc.getMyReviewStats(req.instructor.id);
  return res.json({ success: true, data: result });
});

module.exports = {
  listReviews,
  getStats,
};
