// Validation for the Competencies API — Part 1 (Skills + Stats + Analytics).
// Same contract as instructors.validator: every function returns
// { isValid, errors, data } with each field parsed, trimmed, bounded and
// allow-listed here, so the service only ever receives safe values.

const SKILL_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT", "CERTIFIED"];
const SKILL_STATUSES = ["ACTIVE", "ARCHIVED"];
const FRAMEWORK_STATUSES = ["ACTIVE", "DRAFT", "ARCHIVED"];
const FRAMEWORK_IMPORTANCE = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const CATEGORY_STATUSES = ["ACTIVE", "ARCHIVED"];
const ASSESSMENT_TYPES = ["QUIZ", "PRACTICAL", "ASSIGNMENT", "LIVE_EVALUATION", "CERTIFICATION_EXAM"];

const MAX = {
  name: 150,
  description: 2000,
  search: 200,
  limit: 100,
};

// ── Shared field readers (mirrors instructors.validator) ───────────────────────

function validateId(id, label = "id") {
  if (!id || typeof id !== "string" || id.trim().length === 0) return `${label} is required.`;
  return null;
}

function readString(value, key, max, errors, { required = false, min = 0 } = {}) {
  if (value === undefined) {
    if (required) errors.push(`${key} is required.`);
    return undefined;
  }
  if (value === null) {
    if (required) { errors.push(`${key} cannot be null.`); return undefined; }
    return null;
  }
  if (typeof value !== "string") { errors.push(`${key} must be a string.`); return undefined; }
  const s = value.trim();
  if (!s) {
    if (required) { errors.push(`${key} is required.`); return undefined; }
    return null;
  }
  if (s.length < min) { errors.push(`${key} must be at least ${min} characters.`); return undefined; }
  if (s.length > max) { errors.push(`${key} must be at most ${max} characters.`); return undefined; }
  return s;
}

function readEnum(value, key, allowed, errors, { required = false } = {}) {
  if (value === undefined) {
    if (required) errors.push(`${key} is required.`);
    return undefined;
  }
  if (value === null) return null;
  const v = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!allowed.includes(v)) {
    errors.push(`${key} must be one of: ${allowed.join(", ")}.`);
    return undefined;
  }
  return v;
}

function readPagination(query, errors) {
  const data = { page: 1, limit: 10 };
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
  return data;
}

function pickDefined(source) {
  const out = {};
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

// ── Skills list query ────────────────────────────────────────────────────────

function validateSkillListQuery(query = {}) {
  const errors = [];
  const data = readPagination(query, errors);

  const search = readString(query.search, "search", MAX.search, errors);
  if (search) data.search = search;

  const categoryId = readString(query.categoryId, "categoryId", 100, errors);
  if (categoryId) data.categoryId = categoryId;

  const level = readEnum(query.level, "level", SKILL_LEVELS, errors);
  if (level) data.level = level;

  const status = readEnum(query.status, "status", SKILL_STATUSES, errors);
  if (status) data.status = status;

  return { isValid: errors.length === 0, errors, data };
}

// ── Skill create / update ───────────────────────────────────────────────────

function validateSkillCreate(body = {}) {
  const errors = [];

  const name = readString(body.name, "name", MAX.name, errors, { required: true, min: 2 });
  const description = readString(body.description, "description", MAX.description, errors);
  const categoryId = readString(body.categoryId, "categoryId", 100, errors);
  const level = readEnum(body.level, "level", SKILL_LEVELS, errors) ?? "BEGINNER";
  const status = readEnum(body.status, "status", SKILL_STATUSES, errors) ?? "ACTIVE";

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      name,
      description: description ?? null,
      categoryId: categoryId ?? null,
      level,
      status,
    },
  };
}

function validateSkillUpdate(body = {}) {
  const errors = [];
  const data = {};

  if (body.name !== undefined) {
    const name = readString(body.name, "name", MAX.name, errors, { required: true, min: 2 });
    if (name !== undefined) data.name = name;
  }
  if (body.description !== undefined) {
    const description = readString(body.description, "description", MAX.description, errors);
    data.description = description ?? null;
  }
  if (body.categoryId !== undefined) {
    const categoryId = readString(body.categoryId, "categoryId", 100, errors);
    data.categoryId = categoryId ?? null;
  }
  if (body.level !== undefined) {
    const level = readEnum(body.level, "level", SKILL_LEVELS, errors);
    if (level !== undefined && level !== null) data.level = level;
  }
  if (body.status !== undefined) {
    const status = readEnum(body.status, "status", SKILL_STATUSES, errors);
    if (status !== undefined && status !== null) data.status = status;
  }

  if (errors.length === 0 && Object.keys(data).length === 0) {
    errors.push("No valid fields provided to update.");
  }

  return { isValid: errors.length === 0, errors, data: pickDefined(data) };
}

// ── Assign / unassign course ────────────────────────────────────────────────

function validateAssignCourse(body = {}) {
  const errors = [];
  const courseId = readString(body.courseId, "courseId", 100, errors, { required: true });
  return { isValid: errors.length === 0, errors, data: { courseId } };
}

// ── Frameworks ───────────────────────────────────────────────────────────────

function validateFrameworkListQuery(query = {}) {
  const errors = [];
  const data = readPagination(query, errors);

  const search = readString(query.search, "search", MAX.search, errors);
  if (search) data.search = search;

  const status = readEnum(query.status, "status", FRAMEWORK_STATUSES, errors);
  if (status) data.status = status;

  return { isValid: errors.length === 0, errors, data };
}

function validateFrameworkCreate(body = {}) {
  const errors = [];
  const name = readString(body.name, "name", MAX.name, errors, { required: true, min: 2 });
  const description = readString(body.description, "description", MAX.description, errors);
  const status = readEnum(body.status, "status", FRAMEWORK_STATUSES, errors) ?? "DRAFT";
  return { isValid: errors.length === 0, errors, data: { name, description: description ?? null, status } };
}

function validateFrameworkUpdate(body = {}) {
  const errors = [];
  const data = {};

  if (body.name !== undefined) {
    const name = readString(body.name, "name", MAX.name, errors, { required: true, min: 2 });
    if (name !== undefined) data.name = name;
  }
  if (body.description !== undefined) {
    const description = readString(body.description, "description", MAX.description, errors);
    data.description = description ?? null;
  }
  if (body.status !== undefined) {
    const status = readEnum(body.status, "status", FRAMEWORK_STATUSES, errors);
    if (status !== undefined && status !== null) data.status = status;
  }

  if (errors.length === 0 && Object.keys(data).length === 0) {
    errors.push("No valid fields provided to update.");
  }
  return { isValid: errors.length === 0, errors, data: pickDefined(data) };
}

function validateFrameworkSkillAdd(body = {}) {
  const errors = [];
  const skillId = readString(body.skillId, "skillId", 100, errors, { required: true });
  const requiredLevel = readEnum(body.requiredLevel, "requiredLevel", SKILL_LEVELS, errors, { required: true });
  const importance = readEnum(body.importance, "importance", FRAMEWORK_IMPORTANCE, errors) ?? "MEDIUM";
  return { isValid: errors.length === 0, errors, data: { skillId, requiredLevel, importance } };
}

// ── Skill categories ─────────────────────────────────────────────────────────

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

function readColor(value, errors) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string" || !HEX_COLOR_REGEX.test(value.trim())) {
    errors.push("color must be a hex color, e.g. #2563eb.");
    return undefined;
  }
  return value.trim();
}

function validateCategoryCreate(body = {}) {
  const errors = [];
  const name = readString(body.name, "name", MAX.name, errors, { required: true, min: 2 });
  const description = readString(body.description, "description", MAX.description, errors);
  const color = readColor(body.color, errors);
  const parentId = readString(body.parentId, "parentId", 100, errors);
  return {
    isValid: errors.length === 0,
    errors,
    data: { name, description: description ?? null, color: color ?? null, parentId: parentId ?? null },
  };
}

function validateCategoryUpdate(body = {}) {
  const errors = [];
  const data = {};

  if (body.name !== undefined) {
    const name = readString(body.name, "name", MAX.name, errors, { required: true, min: 2 });
    if (name !== undefined) data.name = name;
  }
  if (body.description !== undefined) {
    const description = readString(body.description, "description", MAX.description, errors);
    data.description = description ?? null;
  }
  if (body.color !== undefined) {
    const color = readColor(body.color, errors);
    data.color = color ?? null;
  }
  if (body.parentId !== undefined || body.parentId === null) {
    const parentId = readString(body.parentId, "parentId", 100, errors);
    data.parentId = parentId ?? null;
  }
  if (body.status !== undefined) {
    const status = readEnum(body.status, "status", CATEGORY_STATUSES, errors);
    if (status !== undefined && status !== null) data.status = status;
  }

  if (errors.length === 0 && Object.keys(data).length === 0) {
    errors.push("No valid fields provided to update.");
  }
  return { isValid: errors.length === 0, errors, data: pickDefined(data) };
}

// ── Assessments ──────────────────────────────────────────────────────────────

function readBoolean(value, key, errors) {
  if (value === undefined) return undefined;
  if (value === "true" || value === true)  return true;
  if (value === "false" || value === false) return false;
  errors.push(`${key} must be true or false.`);
  return undefined;
}

function validateAssessmentListQuery(query = {}) {
  const errors = [];
  const data = readPagination(query, errors);

  const userId = readString(query.userId, "userId", 100, errors);
  if (userId) data.userId = userId;

  const skillId = readString(query.skillId, "skillId", 100, errors);
  if (skillId) data.skillId = skillId;

  const type = readEnum(query.type, "type", ASSESSMENT_TYPES, errors);
  if (type) data.type = type;

  const passed = readBoolean(query.passed, "passed", errors);
  if (passed !== undefined) data.passed = passed;

  return { isValid: errors.length === 0, errors, data };
}

function readIntRequired(value, key, min, max, errors) {
  const n = Number(value);
  if (value === undefined || value === null || !Number.isInteger(n) || n < min || n > max) {
    errors.push(`${key} must be an integer between ${min} and ${max}.`);
    return undefined;
  }
  return n;
}

function validateAssessmentCreate(body = {}) {
  const errors = [];
  const userId = readString(body.userId, "userId", 100, errors, { required: true });
  const skillId = readString(body.skillId, "skillId", 100, errors, { required: true });
  const score = readIntRequired(body.score, "score", 0, 1_000_000, errors);
  const maxScore = readIntRequired(body.maxScore, "maxScore", 1, 1_000_000, errors);
  const type = readEnum(body.type, "type", ASSESSMENT_TYPES, errors, { required: true });
  const assessedById = readString(body.assessedById, "assessedById", 100, errors);

  if (score !== undefined && maxScore !== undefined && score > maxScore) {
    errors.push("score cannot exceed maxScore.");
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: { userId, skillId, score, maxScore, type, assessedById: assessedById ?? null },
  };
}

// ── Skill gaps ───────────────────────────────────────────────────────────────

function validateSkillGapsQuery(query = {}) {
  const errors = [];
  const data = {};

  const departmentId = readString(query.departmentId, "departmentId", 100, errors);
  if (departmentId) data.departmentId = departmentId;

  const frameworkId = readString(query.frameworkId, "frameworkId", 100, errors);
  if (frameworkId) data.frameworkId = frameworkId;

  const userId = readString(query.userId, "userId", 100, errors);
  if (userId) data.userId = userId;

  return { isValid: errors.length === 0, errors, data };
}

// ── Skills CSV import (Import/Export tab) ───────────────────────────────────
//
// Mirrors usersImport.validator's shape (validateHeaders / per-row validate +
// normalize) but simpler — no password hashing, no email-uniqueness concern.
// Columns match the export CSV exactly so a round-trip re-import of an
// exported file never errors on "unknown header": `Linked Courses` and
// `Assigned Users` are accepted but ignored on import (they're computed
// aggregates, not skill-settable data).

const IMPORT_MAX_ROWS = 500;
const IMPORT_MAX_ERRORS = 50;
const IMPORT_REQUIRED_HEADERS = ["Name"];
const IMPORT_ALLOWED_HEADERS = ["Name", "Category", "Level", "Status", "Linked Courses", "Assigned Users"];

function validateSkillCsvHeaders(headers) {
  for (const required of IMPORT_REQUIRED_HEADERS) {
    if (!headers.includes(required)) return `Missing required CSV header: ${required}.`;
  }
  for (const h of headers) {
    if (!IMPORT_ALLOWED_HEADERS.includes(h)) return `Unknown CSV header: ${h}.`;
  }
  return null;
}

function validateSkillCsvRow(row) {
  const errors = [];
  const name = typeof row["Name"] === "string" ? row["Name"].trim() : "";
  const categoryName = typeof row["Category"] === "string" ? row["Category"].trim() : "";
  const levelRaw = typeof row["Level"] === "string" ? row["Level"].trim().toUpperCase() : "";
  const statusRaw = typeof row["Status"] === "string" ? row["Status"].trim().toUpperCase() : "";

  if (!name) errors.push("Name is required.");
  else if (name.length < 2) errors.push("Name must be at least 2 characters.");
  else if (name.length > 150) errors.push("Name must be at most 150 characters.");

  const level = levelRaw || "BEGINNER";
  if (!SKILL_LEVELS.includes(level)) errors.push(`Level must be one of: ${SKILL_LEVELS.join(", ")}.`);

  const status = statusRaw || "ACTIVE";
  if (!SKILL_STATUSES.includes(status)) errors.push(`Status must be one of: ${SKILL_STATUSES.join(", ")}.`);

  if (errors.length > 0) return { valid: false, errors, displayName: name || null };
  return { valid: true, displayName: name, normalized: { name, categoryName: categoryName || null, level, status } };
}

// ── Competency Settings (single row, mirrors validateHierarchySettings) ────

function validateCompetencySettings(body = {}) {
  const errors = [];
  const {
    passingThresholdPercent, gapSeverityCritical, gapSeverityHigh, gapSeverityMedium,
    autoUpdateLevelOnAssess, defaultAssessmentType,
  } = body || {};

  if (passingThresholdPercent !== undefined) {
    if (!Number.isInteger(passingThresholdPercent) || passingThresholdPercent < 1 || passingThresholdPercent > 100) {
      errors.push("passingThresholdPercent must be an integer between 1 and 100.");
    }
  }

  const severityFields = { gapSeverityCritical, gapSeverityHigh, gapSeverityMedium };
  for (const [k, v] of Object.entries(severityFields)) {
    if (v !== undefined && (!Number.isInteger(v) || v < 1 || v > 4)) {
      errors.push(`${k} must be an integer between 1 and 4.`);
    }
  }
  if (
    gapSeverityCritical !== undefined && gapSeverityHigh !== undefined && gapSeverityMedium !== undefined &&
    !(gapSeverityCritical > gapSeverityHigh && gapSeverityHigh > gapSeverityMedium)
  ) {
    errors.push("Severity thresholds must be strictly descending: gapSeverityCritical > gapSeverityHigh > gapSeverityMedium.");
  }

  if (autoUpdateLevelOnAssess !== undefined && typeof autoUpdateLevelOnAssess !== "boolean") {
    errors.push("autoUpdateLevelOnAssess must be a boolean.");
  }

  if (defaultAssessmentType !== undefined) {
    const v = typeof defaultAssessmentType === "string" ? defaultAssessmentType.trim().toUpperCase() : "";
    if (!ASSESSMENT_TYPES.includes(v)) errors.push(`defaultAssessmentType must be one of: ${ASSESSMENT_TYPES.join(", ")}.`);
  }

  return errors;
}

module.exports = {
  SKILL_LEVELS,
  SKILL_STATUSES,
  FRAMEWORK_STATUSES,
  FRAMEWORK_IMPORTANCE,
  CATEGORY_STATUSES,
  ASSESSMENT_TYPES,
  validateId,
  validateSkillListQuery,
  validateSkillCreate,
  validateSkillUpdate,
  validateAssignCourse,
  validateFrameworkListQuery,
  validateFrameworkCreate,
  validateFrameworkUpdate,
  validateFrameworkSkillAdd,
  validateCategoryCreate,
  validateCategoryUpdate,
  validateAssessmentListQuery,
  validateAssessmentCreate,
  validateSkillGapsQuery,
  IMPORT_MAX_ROWS,
  IMPORT_MAX_ERRORS,
  validateSkillCsvHeaders,
  validateSkillCsvRow,
  validateCompetencySettings,
};
