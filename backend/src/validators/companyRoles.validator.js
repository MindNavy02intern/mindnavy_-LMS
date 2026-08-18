// Validation for the Roles & Permissions "Company Roles" tab. Same contract
// as competencies.validator: every function returns { isValid, errors, data }.

const MAX = { name: 60, description: 500, search: 200, limit: 100, permissions: 50 };
const STATUSES = ["ACTIVE", "INACTIVE"];

// Fixed console-permission catalog — deliberately separate from the
// LMS-side Permission model (roles.prisma), which is a dynamic DB table
// assigned to AppUser via UserRoleAssignment. Company Roles govern the
// ADMIN CONSOLE instead, so a small fixed key list is enough; no CRUD UI
// exists for these keys because nothing enforces them yet (see
// CompanyRole's schema comment) — the catalog just keeps values sane.
const CONSOLE_PERMISSIONS = [
  "users.manage", "users.view",
  "roles.manage",
  "settings.manage",
  "reports.view", "reports.export",
  "organization.manage",
  "courses.manage",
  "finance.manage",
  "integrations.manage",
  "notifications.manage",
];

function validateId(id, label = "id") {
  if (!id || typeof id !== "string" || id.trim().length === 0) return `${label} is required.`;
  return null;
}

function readString(value, key, max, errors, { required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) errors.push(`${key} is required.`);
    return value === null ? null : undefined;
  }
  const s = typeof value === "string" ? value.trim() : "";
  if (!s) { if (required) errors.push(`${key} is required.`); return undefined; }
  if (s.length > max) { errors.push(`${key} must be at most ${max} characters.`); return undefined; }
  return s;
}

function readPermissions(value, errors) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) { errors.push("permissions must be an array."); return undefined; }
  if (value.length > MAX.permissions) { errors.push(`permissions must have at most ${MAX.permissions} items.`); return undefined; }
  const out = [];
  for (const v of value) {
    if (typeof v !== "string" || !CONSOLE_PERMISSIONS.includes(v)) {
      errors.push(`Unknown permission key: ${String(v)}.`);
      return undefined;
    }
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

function validateCreateCompanyRole(body = {}) {
  const errors = [];
  const data = {};
  data.name = readString(body.name, "name", MAX.name, errors, { required: true });
  data.description = body.description === undefined ? undefined : (body.description === null ? null : readString(body.description, "description", MAX.description, errors));
  data.permissions = readPermissions(body.permissions, errors) ?? [];
  if (body.status !== undefined) {
    const s = typeof body.status === "string" ? body.status.trim().toUpperCase() : "";
    if (!STATUSES.includes(s)) errors.push(`status must be one of: ${STATUSES.join(", ")}.`);
    else data.status = s;
  }
  return { isValid: errors.length === 0, errors, data };
}

function validateUpdateCompanyRole(body = {}) {
  const errors = [];
  const data = {};
  if (body.name !== undefined) data.name = readString(body.name, "name", MAX.name, errors, { required: true });
  if (body.description !== undefined) data.description = body.description === null ? null : readString(body.description, "description", MAX.description, errors);
  if (body.permissions !== undefined) data.permissions = readPermissions(body.permissions, errors);
  if (body.status !== undefined) {
    const s = typeof body.status === "string" ? body.status.trim().toUpperCase() : "";
    if (!STATUSES.includes(s)) errors.push(`status must be one of: ${STATUSES.join(", ")}.`);
    else data.status = s;
  }
  if (errors.length === 0 && Object.keys(data).length === 0) errors.push("No valid fields provided to update.");
  return { isValid: errors.length === 0, errors, data };
}

function validateListQuery(query = {}) {
  const errors = [];
  const search = query.search ? readString(query.search, "search", MAX.search, errors) : undefined;
  let status;
  if (query.status) {
    const s = String(query.status).trim().toUpperCase();
    if (!STATUSES.includes(s)) errors.push(`status must be one of: ${STATUSES.join(", ")}.`);
    else status = s;
  }
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(MAX.limit, Math.max(1, Number(query.limit) || 20));
  return { isValid: errors.length === 0, errors, data: { search, status, page, limit } };
}

module.exports = {
  validateId,
  validateCreateCompanyRole,
  validateUpdateCompanyRole,
  validateListQuery,
  CONSOLE_PERMISSIONS,
};
