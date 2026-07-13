// Validation for the Categories API (/api/admin/categories).
// Same contract as the other validators: { isValid, errors, data } with every
// value parsed, trimmed, length-capped and allow-listed before the service.

const MAX = { name: 100, id: 64 };

function validateId(id, label = "id") {
  if (!id || typeof id !== "string" || id.trim().length === 0 || id.length > MAX.id) {
    return `${label} is required.`;
  }
  return null;
}

function parseName(value, errors, { required } = {}) {
  if (value === undefined) {
    if (required) errors.push("name is required.");
    return undefined;
  }
  const name = typeof value === "string" ? value.trim() : "";
  if (!name) { errors.push("name cannot be empty."); return undefined; }
  if (name.length > MAX.name) { errors.push(`name must be at most ${MAX.name} characters.`); return undefined; }
  return name;
}

// parentId: string (subcategory), null (root), or absent.
function parseParentId(value, errors) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string" || !value.trim() || value.length > MAX.id) {
    errors.push("parentId must be a category id or null.");
    return undefined;
  }
  return value.trim();
}

function validateCreate(body = {}) {
  const errors = [];
  const name = parseName(body.name, errors, { required: true });
  const parentId = parseParentId(body.parentId, errors);
  return { isValid: errors.length === 0, errors, data: { name, parentId: parentId ?? null } };
}

function validateUpdate(body = {}) {
  const errors = [];
  const data = {};

  const name = parseName(body.name, errors);
  if (name !== undefined) data.name = name;

  const parentId = parseParentId(body.parentId, errors);
  if (parentId !== undefined || body.parentId === null) data.parentId = parentId ?? null;

  if (errors.length === 0 && Object.keys(data).length === 0) {
    errors.push("No valid fields provided to update.");
  }
  return { isValid: errors.length === 0, errors, data };
}

module.exports = { validateId, validateCreate, validateUpdate };
