// Validation for the Roles & Permissions API.
// Mirrors the existing validator style: each function returns { isValid, errors, data }.

const VALID_ROLE_STATUSES = new Set(["ACTIVE", "INACTIVE"]);
const LIST_STATUS_FILTERS = new Set(["ACTIVE", "INACTIVE", "ALL"]);

const MAX_NAME_LEN              = 100;
const MAX_DESCRIPTION_LEN       = 500;
const MAX_PERMISSIONS_PER_ROLE  = 300;

// Simple required-string id guard (returns an error string or null).
function validateId(id, label = "id") {
  if (!id || typeof id !== "string" || id.trim().length === 0) {
    return `${label} is required.`;
  }
  return null;
}

function validateListRolesQuery(q = {}) {
  const errors = [];

  let page  = Number(q.page);
  let limit = Number(q.limit);
  page  = Number.isInteger(page)  && page  > 0 ? page : 1;
  limit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 200) : 50;

  const search = typeof q.search === "string" ? q.search.trim() : "";

  let status = q.status ? String(q.status).toUpperCase() : "ALL";
  if (!LIST_STATUS_FILTERS.has(status)) {
    errors.push("status must be one of ACTIVE, INACTIVE, ALL.");
  }

  return { isValid: errors.length === 0, errors, data: { page, limit, search, status } };
}

function validateCreateRole(body = {}) {
  const errors = [];

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) errors.push("Role name is required.");
  else if (name.length > MAX_NAME_LEN) errors.push(`Role name must be at most ${MAX_NAME_LEN} characters.`);

  let description = null;
  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== "string") errors.push("Description must be a string.");
    else if (body.description.trim().length > MAX_DESCRIPTION_LEN) errors.push(`Description must be at most ${MAX_DESCRIPTION_LEN} characters.`);
    else description = body.description.trim() || null;
  }

  let status = body.status ? String(body.status).toUpperCase() : "ACTIVE";
  if (!VALID_ROLE_STATUSES.has(status)) errors.push("status must be ACTIVE or INACTIVE.");

  return { isValid: errors.length === 0, errors, data: { name, description, status } };
}

function validateUpdateRole(body = {}) {
  const errors = [];
  const data = {};

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) errors.push("Role name cannot be empty.");
    else if (name.length > MAX_NAME_LEN) errors.push(`Role name must be at most ${MAX_NAME_LEN} characters.`);
    else data.name = name;
  }

  if (body.description !== undefined) {
    if (body.description === null) data.description = null;
    else if (typeof body.description !== "string") errors.push("Description must be a string or null.");
    else if (body.description.trim().length > MAX_DESCRIPTION_LEN) errors.push(`Description must be at most ${MAX_DESCRIPTION_LEN} characters.`);
    else data.description = body.description.trim() || null;
  }

  if (body.status !== undefined) {
    const status = String(body.status).toUpperCase();
    if (!VALID_ROLE_STATUSES.has(status)) errors.push("status must be ACTIVE or INACTIVE.");
    else data.status = status;
  }

  if (errors.length === 0 && Object.keys(data).length === 0) {
    errors.push("No valid fields provided to update.");
  }

  return { isValid: errors.length === 0, errors, data };
}

function validateAssignPermissions(body = {}) {
  if (!Array.isArray(body.permissionIds)) {
    return { isValid: false, errors: ["permissionIds must be an array."], data: { permissionIds: [] } };
  }

  const errors = [];
  const unique = new Set();
  for (const id of body.permissionIds) {
    if (typeof id !== "string" || id.trim().length === 0) {
      errors.push("Each permissionId must be a non-empty string.");
      break;
    }
    unique.add(id);
  }

  const permissionIds = [...unique];
  if (permissionIds.length > MAX_PERMISSIONS_PER_ROLE) {
    errors.push(`A role cannot have more than ${MAX_PERMISSIONS_PER_ROLE} permissions.`);
  }

  return { isValid: errors.length === 0, errors, data: { permissionIds } };
}

module.exports = {
  validateId,
  validateListRolesQuery,
  validateCreateRole,
  validateUpdateRole,
  validateAssignPermissions,
};
