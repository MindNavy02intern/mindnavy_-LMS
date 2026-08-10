// Validation for the Learner Tickets API (/api/admin/learners/:id/tickets).
// Same { isValid, errors, data } contract as every other validator here.
//
// NO create-ticket endpoint exists (matches the task's literal Part 7 spec —
// GET/PATCH only) — there is no learner-facing app in this system to raise
// one, same documented gap as InstructorReview having no submission endpoint.
// Rows exist only via direct DB/seed access until a learner-facing app ships.

const TICKET_STATUSES = new Set(["OPEN", "IN_PROGRESS", "RESOLVED", "ESCALATED", "CLOSED"]);
const TICKET_PRIORITIES = new Set(["LOW", "NORMAL", "HIGH", "URGENT"]);

const MAX = { body: 5000, resolution: 2000, limit: 100 };

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

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
    if (!Number.isInteger(n) || n < 1 || n > MAX.limit) errors.push(`limit must be an integer between 1 and ${MAX.limit}.`);
    else data.limit = n;
  }
  if (query.status !== undefined && String(query.status).trim() !== "") {
    const s = String(query.status).trim().toUpperCase();
    if (!TICKET_STATUSES.has(s)) errors.push(`status must be one of: ${[...TICKET_STATUSES].join(", ")}.`);
    else data.status = s;
  }

  return { isValid: errors.length === 0, errors, data };
}

function validateRespond(body = {}) {
  const errors = [];
  const message = isNonEmptyString(body.body) ? body.body.trim() : "";
  if (!message) errors.push("body is required.");
  else if (message.length > MAX.body) errors.push(`body must be at most ${MAX.body} characters.`);
  return { isValid: errors.length === 0, errors, data: { body: message } };
}

function validateResolve(body = {}) {
  const errors = [];
  let resolution;
  if (body.resolution !== undefined && body.resolution !== null) {
    if (typeof body.resolution !== "string") errors.push("resolution must be a string.");
    else if (body.resolution.trim().length > MAX.resolution) errors.push(`resolution must be at most ${MAX.resolution} characters.`);
    else resolution = body.resolution.trim() || undefined;
  }
  return { isValid: errors.length === 0, errors, data: { resolution } };
}

function validateEscalate(body = {}) {
  const errors = [];
  let priority;
  if (body.priority !== undefined && body.priority !== null) {
    const p = typeof body.priority === "string" ? body.priority.trim().toUpperCase() : "";
    if (!TICKET_PRIORITIES.has(p)) errors.push(`priority must be one of: ${[...TICKET_PRIORITIES].join(", ")}.`);
    else priority = p;
  }
  return { isValid: errors.length === 0, errors, data: { priority } };
}

module.exports = {
  TICKET_STATUSES,
  TICKET_PRIORITIES,
  validateListQuery,
  validateRespond,
  validateResolve,
  validateEscalate,
};
