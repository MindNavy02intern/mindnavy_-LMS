const VALID_LOCATION_TYPES = new Set(["HEAD_OFFICE", "REGIONAL", "LOCAL"]);
const VALID_ORG_STATUSES   = new Set(["ACTIVE", "INACTIVE"]);
const VALID_TEAM_STATUSES  = new Set(["ACTIVE", "INACTIVE"]);

const MOVE_ACTIONS = new Set(["MOVE_DEPARTMENT", "MOVE_TEAM", "MOVE_USER"]);

// ── Shared ─────────────────────────────────────────────────────────────────────

function validateId(id, label = "id") {
  if (!id || typeof id !== "string" || id.trim().length === 0) {
    return `${label} is required.`;
  }
  return null;
}

function strField(val, label, { required = false, max = 255 } = {}) {
  if (required && (!val || typeof val !== "string" || val.trim().length === 0)) {
    return `${label} is required.`;
  }
  if (val !== undefined && val !== null && (typeof val !== "string" || val.trim().length > max)) {
    return `${label} must be a string up to ${max} characters.`;
  }
  return null;
}

// ── Branches ───────────────────────────────────────────────────────────────────

function validateCreateBranch(body) {
  const errors = [];
  const { name, locationType, address, city, country, phone, email, managerId, status } = body || {};

  const nameErr = strField(name, "name", { required: true, max: 100 });
  if (nameErr) errors.push(nameErr);

  if (!locationType || !VALID_LOCATION_TYPES.has(String(locationType).toUpperCase())) {
    errors.push(`locationType is required and must be one of: ${[...VALID_LOCATION_TYPES].join(", ")}.`);
  }

  const addrErr = strField(address, "address", { required: true, max: 500 });
  if (addrErr) errors.push(addrErr);

  const cityErr = strField(city, "city", { required: true, max: 100 });
  if (cityErr) errors.push(cityErr);

  const countryErr = strField(country, "country", { required: true, max: 100 });
  if (countryErr) errors.push(countryErr);

  if (phone  !== undefined && phone  !== null) { const e = strField(phone,  "phone",  { max: 30  }); if (e) errors.push(e); }
  if (email  !== undefined && email  !== null) { const e = strField(email,  "email",  { max: 100 }); if (e) errors.push(e); }
  if (managerId !== undefined && managerId !== null) { const e = strField(managerId, "managerId", { max: 100 }); if (e) errors.push(e); }

  if (status !== undefined && !VALID_ORG_STATUSES.has(String(status).toUpperCase())) {
    errors.push(`status must be one of: ${[...VALID_ORG_STATUSES].join(", ")}.`);
  }

  return errors;
}

function validateUpdateBranch(body) {
  const errors = [];
  if (!body || Object.keys(body).length === 0) {
    return ["At least one field must be provided for update."];
  }

  const { name, locationType, address, city, country, phone, email, managerId, status } = body;

  if (name      !== undefined) { const e = strField(name,      "name",      { required: true, max: 100 }); if (e) errors.push(e); }
  if (locationType !== undefined && !VALID_LOCATION_TYPES.has(String(locationType).toUpperCase())) {
    errors.push(`locationType must be one of: ${[...VALID_LOCATION_TYPES].join(", ")}.`);
  }
  if (address   !== undefined) { const e = strField(address,   "address",   { max: 500 }); if (e) errors.push(e); }
  if (city      !== undefined) { const e = strField(city,      "city",      { max: 100 }); if (e) errors.push(e); }
  if (country   !== undefined) { const e = strField(country,   "country",   { max: 100 }); if (e) errors.push(e); }
  if (phone     !== undefined && phone     !== null) { const e = strField(phone,     "phone",     { max: 30  }); if (e) errors.push(e); }
  if (email     !== undefined && email     !== null) { const e = strField(email,     "email",     { max: 100 }); if (e) errors.push(e); }
  if (managerId !== undefined && managerId !== null) { const e = strField(managerId, "managerId", { max: 100 }); if (e) errors.push(e); }
  if (status    !== undefined && !VALID_ORG_STATUSES.has(String(status).toUpperCase())) {
    errors.push(`status must be one of: ${[...VALID_ORG_STATUSES].join(", ")}.`);
  }

  return errors;
}

// ── Departments ────────────────────────────────────────────────────────────────

function validateCreateDepartment(body) {
  const errors = [];
  const { name, code, description, branchId, managerId, budget, status } = body || {};

  const nameErr = strField(name, "name", { required: true, max: 100 });
  if (nameErr) errors.push(nameErr);

  const branchErr = validateId(branchId, "branchId");
  if (branchErr) errors.push(branchErr);

  if (code        !== undefined && code        !== null) { const e = strField(code,        "code",        { max: 20  }); if (e) errors.push(e); }
  if (description !== undefined && description !== null) { const e = strField(description, "description", { max: 500 }); if (e) errors.push(e); }
  if (managerId   !== undefined && managerId   !== null) { const e = strField(managerId,   "managerId",   { max: 100 }); if (e) errors.push(e); }

  if (budget !== undefined && budget !== null) {
    if (typeof budget !== "number" || budget < 0) {
      errors.push("budget must be a non-negative number.");
    }
  }

  if (status !== undefined && !VALID_ORG_STATUSES.has(String(status).toUpperCase())) {
    errors.push(`status must be one of: ${[...VALID_ORG_STATUSES].join(", ")}.`);
  }

  return errors;
}

function validateUpdateDepartment(body) {
  const errors = [];
  if (!body || Object.keys(body).length === 0) {
    return ["At least one field must be provided for update."];
  }
  const { name, code, description, branchId, managerId, budget, status } = body;

  if (name        !== undefined) { const e = strField(name,        "name",        { required: true, max: 100 }); if (e) errors.push(e); }
  if (code        !== undefined && code        !== null) { const e = strField(code,        "code",        { max: 20  }); if (e) errors.push(e); }
  if (description !== undefined && description !== null) { const e = strField(description, "description", { max: 500 }); if (e) errors.push(e); }
  if (branchId    !== undefined) { const e = validateId(branchId, "branchId");   if (e) errors.push(e); }
  if (managerId   !== undefined && managerId   !== null) { const e = strField(managerId,   "managerId",   { max: 100 }); if (e) errors.push(e); }

  if (budget !== undefined && budget !== null) {
    if (typeof budget !== "number" || budget < 0) {
      errors.push("budget must be a non-negative number.");
    }
  }

  if (status !== undefined && !VALID_ORG_STATUSES.has(String(status).toUpperCase())) {
    errors.push(`status must be one of: ${[...VALID_ORG_STATUSES].join(", ")}.`);
  }

  return errors;
}

// ── Teams ──────────────────────────────────────────────────────────────────────

function validateCreateTeam(body) {
  const errors = [];
  const { name, departmentId, leaderId, description, status } = body || {};

  const nameErr = strField(name, "name", { required: true, max: 100 });
  if (nameErr) errors.push(nameErr);

  const deptErr = validateId(departmentId, "departmentId");
  if (deptErr) errors.push(deptErr);

  if (leaderId    !== undefined && leaderId    !== null) { const e = strField(leaderId,    "leaderId",    { max: 100 }); if (e) errors.push(e); }
  if (description !== undefined && description !== null) { const e = strField(description, "description", { max: 500 }); if (e) errors.push(e); }

  if (status !== undefined && !VALID_TEAM_STATUSES.has(String(status).toUpperCase())) {
    errors.push(`status must be one of: ${[...VALID_TEAM_STATUSES].join(", ")}.`);
  }

  return errors;
}

function validateUpdateTeam(body) {
  const errors = [];
  if (!body || Object.keys(body).length === 0) {
    return ["At least one field must be provided for update."];
  }
  const { name, departmentId, leaderId, description, status } = body;

  if (name         !== undefined) { const e = strField(name,         "name",         { required: true, max: 100 }); if (e) errors.push(e); }
  if (departmentId !== undefined) { const e = validateId(departmentId, "departmentId"); if (e) errors.push(e); }
  if (leaderId     !== undefined && leaderId    !== null) { const e = strField(leaderId,    "leaderId",    { max: 100 }); if (e) errors.push(e); }
  if (description  !== undefined && description !== null) { const e = strField(description, "description", { max: 500 }); if (e) errors.push(e); }

  if (status !== undefined && !VALID_TEAM_STATUSES.has(String(status).toUpperCase())) {
    errors.push(`status must be one of: ${[...VALID_TEAM_STATUSES].join(", ")}.`);
  }

  return errors;
}

// ── Assign users / members ─────────────────────────────────────────────────────

function validateUserIds(body) {
  const errors = [];
  const { userIds } = body || {};
  if (!Array.isArray(userIds) || userIds.length === 0) {
    errors.push("userIds must be a non-empty array.");
  } else if (userIds.some((id) => typeof id !== "string" || id.trim().length === 0)) {
    errors.push("All userIds must be non-empty strings.");
  }
  return errors;
}

function validateDeptIds(body) {
  const errors = [];
  const { departmentIds } = body || {};
  if (!Array.isArray(departmentIds) || departmentIds.length === 0) {
    errors.push("departmentIds must be a non-empty array.");
  } else if (departmentIds.some((id) => typeof id !== "string" || id.trim().length === 0)) {
    errors.push("All departmentIds must be non-empty strings.");
  }
  return errors;
}

// ── Org chart move ─────────────────────────────────────────────────────────────

function validateOrgMove(body) {
  const errors = [];
  const { nodeId, newParentId, action } = body || {};

  const nErr = validateId(nodeId, "nodeId");
  if (nErr) errors.push(nErr);

  const pErr = validateId(newParentId, "newParentId");
  if (pErr) errors.push(pErr);

  if (!action || !MOVE_ACTIONS.has(String(action).toUpperCase())) {
    errors.push(`action must be one of: ${[...MOVE_ACTIONS].join(", ")}.`);
  }

  return errors;
}

// ── Hierarchy settings ─────────────────────────────────────────────────────────

function validateHierarchySettings(body) {
  const errors = [];
  const {
    allowMultiReporting, maxReportingLevels, requireManagerApproval,
    applyRoleBasedAccess, departmentHeadsSeeOwnOnly, inheritPermissionsFromParent,
    allowPermissionOverride, requireApprovalForMoves, approvalLevels,
    autoApproveAfterDays, customRules,
  } = body || {};

  const boolFields = { allowMultiReporting, requireManagerApproval, applyRoleBasedAccess, departmentHeadsSeeOwnOnly, inheritPermissionsFromParent, allowPermissionOverride, requireApprovalForMoves };
  for (const [k, v] of Object.entries(boolFields)) {
    if (v !== undefined && typeof v !== "boolean") {
      errors.push(`${k} must be a boolean.`);
    }
  }

  if (maxReportingLevels !== undefined) {
    if (!Number.isInteger(maxReportingLevels) || maxReportingLevels < 1 || maxReportingLevels > 20) {
      errors.push("maxReportingLevels must be an integer between 1 and 20.");
    }
  }
  if (approvalLevels !== undefined) {
    if (!Number.isInteger(approvalLevels) || approvalLevels < 1 || approvalLevels > 5) {
      errors.push("approvalLevels must be an integer between 1 and 5.");
    }
  }
  if (autoApproveAfterDays !== undefined) {
    if (!Number.isInteger(autoApproveAfterDays) || autoApproveAfterDays < 0 || autoApproveAfterDays > 365) {
      errors.push("autoApproveAfterDays must be an integer between 0 and 365.");
    }
  }
  if (customRules !== undefined && customRules !== null && typeof customRules !== "string") {
    errors.push("customRules must be a string.");
  }

  return errors;
}

module.exports = {
  validateId,
  validateCreateBranch,
  validateUpdateBranch,
  validateCreateDepartment,
  validateUpdateDepartment,
  validateCreateTeam,
  validateUpdateTeam,
  validateUserIds,
  validateDeptIds,
  validateOrgMove,
  validateHierarchySettings,
};
