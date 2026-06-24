// Validation for the Access Policies API.
// Mirrors roles.validator style: each function returns { isValid, errors, data }.

const VALID_STATUSES      = new Set(["ACTIVE", "INACTIVE"]);
const LIST_STATUS_FILTERS = new Set(["ACTIVE", "INACTIVE", "ALL"]);
const VALID_EFFECTS       = new Set(["ALLOW", "DENY"]);
const LIST_EFFECT_FILTERS = new Set(["ALLOW", "DENY", "ALL"]);
const VALID_RESOURCES     = new Set(["USERS", "REPORTS", "SETTINGS", "ORGANIZATION", "LEARNERS", "COURSES", "ADMIN"]);
const VALID_ACTIONS       = new Set(["VIEW", "CREATE", "EDIT", "DELETE", "MANAGE", "EXPORT"]);

const MAX_NAME_LEN        = 100;
const MAX_DESCRIPTION_LEN = 500;
const MAX_PRIORITY        = 1000;

// Simple required-string id guard (returns an error string or null).
function validateId(id, label = "id") {
  if (!id || typeof id !== "string" || id.trim().length === 0) {
    return `${label} is required.`;
  }
  return null;
}

function validateListQuery(q = {}) {
  const errors = [];

  let page  = Number(q.page);
  let limit = Number(q.limit);
  page  = Number.isInteger(page)  && page  > 0 ? page : 1;
  limit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 200) : 50;

  const search = typeof q.search === "string" ? q.search.trim() : "";

  const status = q.status ? String(q.status).toUpperCase() : "ALL";
  if (!LIST_STATUS_FILTERS.has(status)) errors.push("status must be one of ACTIVE, INACTIVE, ALL.");

  const effect = q.effect ? String(q.effect).toUpperCase() : "ALL";
  if (!LIST_EFFECT_FILTERS.has(effect)) errors.push("effect must be one of ALLOW, DENY, ALL.");

  let resource = null;
  if (q.resource !== undefined && q.resource !== null && String(q.resource).trim() !== "") {
    const r = String(q.resource).toUpperCase();
    if (r !== "ALL") {
      if (!VALID_RESOURCES.has(r)) errors.push("resource is not a valid value.");
      else resource = r;
    }
  }

  let action = null;
  if (q.action !== undefined && q.action !== null && String(q.action).trim() !== "") {
    const a = String(q.action).toUpperCase();
    if (a !== "ALL") {
      if (!VALID_ACTIONS.has(a)) errors.push("action is not a valid value.");
      else action = a;
    }
  }

  let roleId = null;
  if (q.roleId !== undefined && q.roleId !== null && String(q.roleId).trim() !== "") {
    roleId = String(q.roleId).trim();
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: { page, limit, search, status, effect, resource, action, roleId },
  };
}

function validateCreate(body = {}) {
  const errors = [];

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) errors.push("Policy name is required.");
  else if (name.length > MAX_NAME_LEN) errors.push(`Policy name must be at most ${MAX_NAME_LEN} characters.`);

  let description = null;
  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== "string") errors.push("Description must be a string.");
    else if (body.description.trim().length > MAX_DESCRIPTION_LEN) errors.push(`Description must be at most ${MAX_DESCRIPTION_LEN} characters.`);
    else description = body.description.trim() || null;
  }

  const resource = body.resource ? String(body.resource).toUpperCase() : "";
  if (!resource) errors.push("resource is required.");
  else if (!VALID_RESOURCES.has(resource)) errors.push("resource is not a valid value.");

  const action = body.action ? String(body.action).toUpperCase() : "";
  if (!action) errors.push("action is required.");
  else if (!VALID_ACTIONS.has(action)) errors.push("action is not a valid value.");

  const effect = body.effect ? String(body.effect).toUpperCase() : "ALLOW";
  if (!VALID_EFFECTS.has(effect)) errors.push("effect must be ALLOW or DENY.");

  const status = body.status ? String(body.status).toUpperCase() : "ACTIVE";
  if (!VALID_STATUSES.has(status)) errors.push("status must be ACTIVE or INACTIVE.");

  let priority = 0;
  if (body.priority !== undefined && body.priority !== null) {
    const p = Number(body.priority);
    if (!Number.isInteger(p) || p < 0 || p > MAX_PRIORITY) errors.push(`priority must be an integer between 0 and ${MAX_PRIORITY}.`);
    else priority = p;
  }

  let roleId = null;
  if (body.roleId !== undefined && body.roleId !== null && String(body.roleId).trim() !== "") {
    if (typeof body.roleId !== "string") errors.push("roleId must be a string.");
    else roleId = body.roleId.trim();
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: { name, description, resource, action, effect, status, priority, roleId },
  };
}

function validateUpdate(body = {}) {
  const errors = [];
  const data = {};

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) errors.push("Policy name cannot be empty.");
    else if (name.length > MAX_NAME_LEN) errors.push(`Policy name must be at most ${MAX_NAME_LEN} characters.`);
    else data.name = name;
  }

  if (body.description !== undefined) {
    if (body.description === null) data.description = null;
    else if (typeof body.description !== "string") errors.push("Description must be a string or null.");
    else if (body.description.trim().length > MAX_DESCRIPTION_LEN) errors.push(`Description must be at most ${MAX_DESCRIPTION_LEN} characters.`);
    else data.description = body.description.trim() || null;
  }

  if (body.resource !== undefined) {
    const r = String(body.resource).toUpperCase();
    if (!VALID_RESOURCES.has(r)) errors.push("resource is not a valid value.");
    else data.resource = r;
  }

  if (body.action !== undefined) {
    const a = String(body.action).toUpperCase();
    if (!VALID_ACTIONS.has(a)) errors.push("action is not a valid value.");
    else data.action = a;
  }

  if (body.effect !== undefined) {
    const e = String(body.effect).toUpperCase();
    if (!VALID_EFFECTS.has(e)) errors.push("effect must be ALLOW or DENY.");
    else data.effect = e;
  }

  if (body.status !== undefined) {
    const s = String(body.status).toUpperCase();
    if (!VALID_STATUSES.has(s)) errors.push("status must be ACTIVE or INACTIVE.");
    else data.status = s;
  }

  if (body.priority !== undefined) {
    const p = Number(body.priority);
    if (!Number.isInteger(p) || p < 0 || p > MAX_PRIORITY) errors.push(`priority must be an integer between 0 and ${MAX_PRIORITY}.`);
    else data.priority = p;
  }

  if (body.roleId !== undefined) {
    if (body.roleId === null || String(body.roleId).trim() === "") data.roleId = null;
    else if (typeof body.roleId !== "string") errors.push("roleId must be a string or null.");
    else data.roleId = body.roleId.trim();
  }

  if (errors.length === 0 && Object.keys(data).length === 0) {
    errors.push("No valid fields provided to update.");
  }

  return { isValid: errors.length === 0, errors, data };
}

module.exports = {
  validateId,
  validateListQuery,
  validateCreate,
  validateUpdate,
};
