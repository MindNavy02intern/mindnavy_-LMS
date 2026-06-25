// Validation for the Role Templates API.
// Mirrors the existing validator style: each function returns { isValid, errors, data }.

const MAX_NAME_LEN              = 100;
const MAX_DESCRIPTION_LEN       = 500;
const MAX_PERMISSIONS_PER_TPL   = 300; // hard cap so a bundle can never be unbounded

// Simple required-string id guard (returns an error string or null).
function validateId(id, label = "id") {
  if (!id || typeof id !== "string" || id.trim().length === 0) {
    return `${label} is required.`;
  }
  return null;
}

function validateListTemplatesQuery(q = {}) {
  let page  = Number(q.page);
  let limit = Number(q.limit);
  page  = Number.isInteger(page)  && page  > 0 ? page : 1;
  limit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 200) : 50;

  const search = typeof q.search === "string" ? q.search.trim() : "";

  return { isValid: true, errors: [], data: { page, limit, search } };
}

// Shared: normalise body.permissions into a deduped string[] of permission IDs.
// Returns { ok, ids, error }.
function normalisePermissionIds(value) {
  if (!Array.isArray(value)) {
    return { ok: false, error: "permissions must be an array of permission IDs." };
  }
  const unique = new Set();
  for (const id of value) {
    if (typeof id !== "string" || id.trim().length === 0) {
      return { ok: false, error: "Each permission ID must be a non-empty string." };
    }
    unique.add(id.trim());
  }
  const ids = [...unique];
  if (ids.length > MAX_PERMISSIONS_PER_TPL) {
    return { ok: false, error: `A template cannot have more than ${MAX_PERMISSIONS_PER_TPL} permissions.` };
  }
  return { ok: true, ids };
}

function validateCreateTemplate(body = {}) {
  const errors = [];

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) errors.push("Template name is required.");
  else if (name.length > MAX_NAME_LEN) errors.push(`Template name must be at most ${MAX_NAME_LEN} characters.`);

  let description = null;
  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== "string") errors.push("Description must be a string.");
    else if (body.description.trim().length > MAX_DESCRIPTION_LEN) errors.push(`Description must be at most ${MAX_DESCRIPTION_LEN} characters.`);
    else description = body.description.trim() || null;
  }

  const perm = normalisePermissionIds(body.permissions ?? []);
  if (!perm.ok) errors.push(perm.error);

  return {
    isValid: errors.length === 0,
    errors,
    data: { name, description, permissions: perm.ids ?? [] },
  };
}

// POST /:id/apply body — applies a template's bundle to an existing Role.
function validateApplyTemplate(body = {}) {
  const errors = [];
  const roleIdErr = validateId(body.roleId, "roleId");
  if (roleIdErr) errors.push(roleIdErr);

  return {
    isValid: errors.length === 0,
    errors,
    data: { roleId: typeof body.roleId === "string" ? body.roleId.trim() : body.roleId },
  };
}

module.exports = {
  validateId,
  validateListTemplatesQuery,
  validateCreateTemplate,
  validateApplyTemplate,
};
