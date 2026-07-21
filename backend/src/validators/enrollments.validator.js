// Validation for the Enrollments API. Same conventions as quizzes.validator:
// { isValid, errors, data } with everything trimmed, bounded and allow-listed.
//
// DECISION (documented in the contract): progress is LEARNER-derived and is not
// admin-writable — the only PATCHable field is status. The status values are the
// EXISTING EnrollmentStatus enum (the LM trend chart and KPIs are built on them);
// DROPPED is deferred to v2 — unenroll (DELETE) covers the admin use case.

const STATUSES = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "OVERDUE"];

const MAX = { search: 200, page: 100000, limit: 100 };

function validateId(id, label = "id") {
  if (!id || typeof id !== "string" || id.trim().length === 0) return `${label} is required.`;
  return null;
}

function readRef(value, key, errors, { required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) errors.push(`${key} is required.`);
    return undefined;
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${key} must be a non-empty string.`);
    return undefined;
  }
  return value.trim();
}

function readStatus(value, errors) {
  const s = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!STATUSES.includes(s)) {
    errors.push(`status must be one of: ${STATUSES.join(", ")}.`);
    return undefined;
  }
  return s;
}

function validateEnrollCreate(body = {}) {
  const errors = [];
  const courseId = readRef(body.courseId, "courseId", errors, { required: true });
  const userId   = readRef(body.userId, "userId", errors, { required: true });
  return { isValid: errors.length === 0, errors, data: { courseId, userId } };
}

function validateEnrollUpdate(body = {}) {
  const errors = [];

  // Reject learner-owned / server-owned fields loudly so a bad client learns why.
  if (body.progress !== undefined) errors.push("progress is learner-derived and cannot be set by admins.");
  if (body.completedAt !== undefined) errors.push("completedAt is server-managed (set when status becomes COMPLETED).");

  if (body.status === undefined) {
    if (errors.length === 0) errors.push("status is required (the only updatable field).");
    return { isValid: false, errors, data: {} };
  }
  const status = readStatus(body.status, errors);

  return { isValid: errors.length === 0, errors, data: { status } };
}

function validateListQuery(query = {}) {
  const errors = [];
  const data = {};

  const courseId = readRef(query.courseId, "courseId", errors);
  if (courseId) data.courseId = courseId;
  const userId = readRef(query.userId, "userId", errors);
  if (userId) data.userId = userId;

  if (query.status !== undefined) {
    const status = readStatus(query.status, errors);
    if (status) data.status = status;
  }

  if (query.search !== undefined) {
    const s = String(query.search).trim();
    if (s.length > MAX.search) errors.push(`search must be at most ${MAX.search} characters.`);
    else if (s) data.search = s;
  }

  // paginate() in the service re-clamps; parse loosely here.
  data.page = query.page;
  data.limit = query.limit;

  return { isValid: errors.length === 0, errors, data };
}

module.exports = {
  validateId,
  validateEnrollCreate,
  validateEnrollUpdate,
  validateListQuery,
  STATUSES,
};
