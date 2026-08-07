// Validation for the Instructor Reviews API
// (/api/admin/instructors/:id/reviews). Same contract as instructors.validator:
// every function returns { isValid, errors, data }.
//
// NOTE: INSTRUCTORS_CONTRACT.md v1 documents "no Review model" as a deliberate
// gap ("decision for Hassan, not a bug"). This module ships it anyway, at the
// user's explicit direction — see instructors.prisma InstructorReview comment.

const REVIEW_STATUSES = new Set(["PENDING", "APPROVED", "REMOVED", "FLAGGED"]);

const MAX = { limit: 100 };

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

// ── List query ──────────────────────────────────────────────────────────────────

function validateListQuery(query = {}) {
  const errors = [];
  const data = { page: 1, limit: 20 };

  if (query.page !== undefined) {
    const n = Number(query.page);
    if (!Number.isInteger(n) || n < 1) errors.push("page must be a positive integer.");
    else data.page = n;
  }
  if (query.limit !== undefined) {
    const n = Number(query.limit);
    if (!Number.isInteger(n) || n < 1 || n > MAX.limit) {
      errors.push(`limit must be an integer between 1 and ${MAX.limit}.`);
    } else {
      data.limit = n;
    }
  }
  if (query.status !== undefined && String(query.status).trim() !== "") {
    const s = String(query.status).trim().toUpperCase();
    if (!REVIEW_STATUSES.has(s)) errors.push(`status must be one of: ${[...REVIEW_STATUSES].join(", ")}.`);
    else data.status = s;
  }

  return { isValid: errors.length === 0, errors, data };
}

module.exports = {
  REVIEW_STATUSES,
  validateListQuery,
  isNonEmptyString,
};
