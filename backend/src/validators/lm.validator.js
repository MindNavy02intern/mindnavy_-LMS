// Validation for the Learning Management Overview API (/api/admin/lm/*).
// Mirrors accessPolicies.validator style: each function returns { isValid, errors, data }.
// Every query param is parsed, allow-listed and clamped here so the service only
// ever sees safe, bounded values (no unbounded queries, no injection surface).

const PROGRESS_RANGES  = new Set(["week", "month", "year"]);
const SESSION_STATUSES = new Set(["upcoming", "live", "ended"]);
const MAX_LIMIT        = 100;

// Clamp an arbitrary `limit` query value to a safe positive integer ≤ MAX_LIMIT.
function clampLimit(value, fallback) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return fallback;
  return Math.min(n, MAX_LIMIT);
}

function validateRange(q = {}) {
  const range = q.range ? String(q.range).toLowerCase() : "month";
  if (!PROGRESS_RANGES.has(range)) {
    return { isValid: false, errors: ["range must be one of week, month, year."], data: { range: "month" } };
  }
  return { isValid: true, errors: [], data: { range } };
}

function validateLimit(q = {}, fallback = 5) {
  return { isValid: true, errors: [], data: { limit: clampLimit(q.limit, fallback) } };
}

function validateSessionStatus(q = {}) {
  const status = q.status ? String(q.status).toLowerCase() : "upcoming";
  if (!SESSION_STATUSES.has(status)) {
    return { isValid: false, errors: ["status must be one of upcoming, live, ended."], data: { status: "upcoming" } };
  }
  return { isValid: true, errors: [], data: { status } };
}

function validateCoursesQuery(q = {}) {
  const errors = [];

  let page  = Number(q.page);
  let limit = Number(q.limit);
  page  = Number.isInteger(page)  && page  > 0 ? page : 1;
  limit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, MAX_LIMIT) : 10;

  const category   = typeof q.category   === "string" && q.category.trim()   ? q.category.trim()   : null;
  const instructor = typeof q.instructor === "string" && q.instructor.trim() ? q.instructor.trim() : null;

  return { isValid: errors.length === 0, errors, data: { page, limit, category, instructor } };
}

module.exports = {
  validateRange,
  validateLimit,
  validateSessionStatus,
  validateCoursesQuery,
};
