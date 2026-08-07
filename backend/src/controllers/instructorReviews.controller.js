const svc = require("../services/instructorReviews.service");
const { validateId } = require("../validators/instructors.validator");
const { validateListQuery } = require("../validators/instructorReviews.validator");

// ── Helpers (same shape as instructorDocuments.controller) ─────────────────────

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
    // Deliberately the same answer as a missing id — a review belonging to
    // another instructor must not be distinguishable from one that never existed.
    case "REVIEW_NOT_FOUND":
      return notFound(res, "Review not found.");
    default:
      return null;
  }
}

function serverError(res, err) {
  console.error("[InstructorReviewsController]", err);
  if (err.code === "P2025") return notFound(res, "Review not found.");
  if (err.code === "P2021" || err.code === "P2022") {
    return res.status(503).json({ success: false, message: "Database not migrated yet. Run `npx prisma db push`." });
  }
  return res.status(500).json({ success: false, message: "Internal server error." });
}

function run(handler) {
  return async (req, res) => {
    try {
      const idErr = validateId(req.params.id, "instructorId");
      if (idErr) return badRequest(res, idErr);
      return await handler(req, res);
    } catch (err) {
      return handleDomainError(res, err) ?? serverError(res, err);
    }
  };
}

// ── Handlers ────────────────────────────────────────────────────────────────────

const listReviews = run(async (req, res) => {
  const v = validateListQuery(req.query);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await svc.listReviews(req.params.id, v.data);
  return res.json({ success: true, data: result });
});

function reviewIdErr(req, res) {
  const err = validateId(req.params.reviewId, "reviewId");
  if (err) { badRequest(res, err); return true; }
  return false;
}

const approveReview = run(async (req, res) => {
  if (reviewIdErr(req, res)) return;
  const review = await svc.approveReview(req.params.id, req.params.reviewId, req.admin?.id);
  return res.json({ success: true, message: "Review approved.", data: review });
});

const removeReview = run(async (req, res) => {
  if (reviewIdErr(req, res)) return;
  const review = await svc.removeReview(req.params.id, req.params.reviewId, req.admin?.id);
  return res.json({ success: true, message: "Review removed.", data: review });
});

const flagReview = run(async (req, res) => {
  if (reviewIdErr(req, res)) return;
  const review = await svc.flagReview(req.params.id, req.params.reviewId, req.admin?.id);
  return res.json({ success: true, message: "Review flagged.", data: review });
});

module.exports = {
  listReviews,
  approveReview,
  removeReview,
  flagReview,
};
