// Validation for the Roles & Permissions "Delegated Admins" tab.

const MAX = { reason: 500, limit: 100 };
const STATUSES = ["ACTIVE", "REVOKED", "EXPIRED"];

function validateId(id, label = "id") {
  if (!id || typeof id !== "string" || id.trim().length === 0) return `${label} is required.`;
  return null;
}

function validateGrant(body = {}) {
  const errors = [];
  const data = {};

  data.adminId = typeof body.adminId === "string" ? body.adminId.trim() : "";
  if (!data.adminId) errors.push("adminId is required.");

  data.scopeRole = typeof body.scopeRole === "string" ? body.scopeRole.trim() : "";
  if (!data.scopeRole) errors.push("scopeRole is required.");

  if (body.reason !== undefined && body.reason !== null) {
    const s = typeof body.reason === "string" ? body.reason.trim() : "";
    if (s.length > MAX.reason) errors.push(`reason must be at most ${MAX.reason} characters.`);
    else data.reason = s || null;
  } else {
    data.reason = null;
  }

  if (body.expiresAt !== undefined && body.expiresAt !== null) {
    const d = new Date(body.expiresAt);
    if (Number.isNaN(d.getTime())) errors.push("expiresAt must be a valid date.");
    else if (d.getTime() <= Date.now()) errors.push("expiresAt must be in the future.");
    else data.expiresAt = d;
  } else {
    data.expiresAt = null;
  }

  return { isValid: errors.length === 0, errors, data };
}

function validateListQuery(query = {}) {
  const errors = [];
  let status;
  if (query.status) {
    const s = String(query.status).trim().toUpperCase();
    if (!STATUSES.includes(s)) errors.push(`status must be one of: ${STATUSES.join(", ")}.`);
    else status = s;
  }
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(MAX.limit, Math.max(1, Number(query.limit) || 20));
  return { isValid: errors.length === 0, errors, data: { status, page, limit } };
}

module.exports = {
  validateId,
  validateGrant,
  validateListQuery,
};
