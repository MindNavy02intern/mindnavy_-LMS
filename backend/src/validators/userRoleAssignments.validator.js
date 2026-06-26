// Validation for the User Role Assignments API.
// Mirrors the existing validator style: each function returns { isValid, errors, data }.

const VALID_TYPES        = new Set(["PRIMARY", "SECONDARY", "TEMPORARY", "EMERGENCY"]);
const VALID_STATUS_FILTERS = new Set(["ACTIVE", "EXPIRED", "ALL"]);

// Simple required-string id guard (returns an error string or null).
function validateId(id, label = "id") {
  if (!id || typeof id !== "string" || id.trim().length === 0) {
    return `${label} is required.`;
  }
  return null;
}

// Parse an optional expiry date. Returns { ok, value (Date|null), error }.
// null is allowed (clears expiry); a present value must be a valid FUTURE date.
function parseOptionalExpiry(raw) {
  if (raw === undefined || raw === null || raw === "") return { ok: true, value: null };
  const d = new Date(raw);
  if (isNaN(d.getTime())) return { ok: false, error: "expiresAt must be a valid date." };
  if (d <= new Date())    return { ok: false, error: "expiresAt must be in the future." };
  return { ok: true, value: d };
}

function validateListAssignmentsQuery(q = {}) {
  const errors = [];

  let page  = Number(q.page);
  let limit = Number(q.limit);
  page  = Number.isInteger(page)  && page  > 0 ? page : 1;
  limit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 200) : 50;

  const search = typeof q.search === "string" ? q.search.trim() : "";

  let assignmentType = null;
  if (q.assignmentType !== undefined && q.assignmentType !== null && String(q.assignmentType).trim() !== "") {
    const t = String(q.assignmentType).toUpperCase();
    if (t !== "ALL") {
      if (!VALID_TYPES.has(t)) errors.push("assignmentType is not a valid type.");
      else assignmentType = t;
    }
  }

  let status = q.status ? String(q.status).toUpperCase() : "ALL";
  if (!VALID_STATUS_FILTERS.has(status)) errors.push("status must be one of ACTIVE, EXPIRED, ALL.");

  return {
    isValid: errors.length === 0,
    errors,
    data: { page, limit, search, assignmentType, status },
  };
}

function validateCreateAssignment(body = {}) {
  const errors = [];

  const userIdErr = validateId(body.userId, "userId");
  if (userIdErr) errors.push(userIdErr);
  const roleIdErr = validateId(body.roleId, "roleId");
  if (roleIdErr) errors.push(roleIdErr);

  let assignmentType = body.assignmentType ? String(body.assignmentType).toUpperCase() : "PRIMARY";
  if (!VALID_TYPES.has(assignmentType)) {
    errors.push("assignmentType must be one of PRIMARY, SECONDARY, TEMPORARY, EMERGENCY.");
  }

  const exp = parseOptionalExpiry(body.expiresAt);
  if (!exp.ok) errors.push(exp.error);

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      userId: typeof body.userId === "string" ? body.userId.trim() : body.userId,
      roleId: typeof body.roleId === "string" ? body.roleId.trim() : body.roleId,
      assignmentType,
      expiresAt: exp.value ?? null,
    },
  };
}

// PATCH /:id — edit assignmentType and/or expiresAt. At least one must be present.
function validateUpdateAssignment(body = {}) {
  const errors = [];
  const data = {};

  if (body.assignmentType !== undefined) {
    const t = String(body.assignmentType).toUpperCase();
    if (!VALID_TYPES.has(t)) errors.push("assignmentType must be one of PRIMARY, SECONDARY, TEMPORARY, EMERGENCY.");
    else data.assignmentType = t;
  }

  if (body.expiresAt !== undefined) {
    const exp = parseOptionalExpiry(body.expiresAt);
    if (!exp.ok) errors.push(exp.error);
    else data.expiresAt = exp.value; // Date or null (clears expiry)
  }

  if (errors.length === 0 && Object.keys(data).length === 0) {
    errors.push("No valid fields provided to update.");
  }

  return { isValid: errors.length === 0, errors, data };
}

module.exports = {
  validateId,
  validateListAssignmentsQuery,
  validateCreateAssignment,
  validateUpdateAssignment,
};
