// Reports & Analytics validators — same contract as every other *.validator.js
// in this codebase: every function returns { isValid, errors, data } (or, for
// the shared `resolveDateRange` helper, pushes onto a caller-supplied `errors`
// array and returns null on failure) so services only ever receive safe values.

const MAX = { search: 200, limit: 100 };

// ── Shared field readers (mirrors competencies.validator / instructors.validator) ──

function readString(value, key, max, errors, { required = false, min = 0 } = {}) {
  if (value === undefined) {
    if (required) errors.push(`${key} is required.`);
    return undefined;
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

function readPagination(query, errors) {
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
  return data;
}

// ── Date range — shared by every report endpoint ────────────────────────────
//
// Judgment call (task spec names "This Week/Month/Quarter/Custom" as UI
// options, not exact calendar semantics): rolling windows, not calendar
// week/month/quarter — "week" = trailing 7 days, "month" = trailing 30ish
// days (same day last month), "quarter" = trailing 3 months. Matches
// lm.validator's own `range` default of "month" when omitted.

const DATE_RANGES = new Set(["week", "month", "quarter", "custom"]);

function resolveDateRange(query, errors) {
  const raw = query.dateRange ? String(query.dateRange).trim().toLowerCase() : "month";
  if (!DATE_RANGES.has(raw)) {
    errors.push(`dateRange must be one of: ${[...DATE_RANGES].join(", ")}.`);
    return null;
  }

  const now = new Date();
  if (raw === "custom") {
    const from = query.dateFrom ? new Date(query.dateFrom) : null;
    const to = query.dateTo ? new Date(query.dateTo) : null;
    if (!from || Number.isNaN(from.getTime()) || !to || Number.isNaN(to.getTime())) {
      errors.push("dateFrom and dateTo (valid ISO dates) are required when dateRange is custom.");
      return null;
    }
    if (from > to) { errors.push("dateFrom must be before dateTo."); return null; }
    return { range: "custom", gte: from, lte: to };
  }

  let gte;
  if (raw === "week")    gte = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (raw === "month")   gte = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, now.getUTCDate()));
  if (raw === "quarter") gte = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 3, now.getUTCDate()));
  return { range: raw, gte, lte: now };
}

// ── Per-endpoint query validators ───────────────────────────────────────────

function validateOverviewQuery(query = {}) {
  const errors = [];
  const dateRange = resolveDateRange(query, errors);
  const department = readString(query.department, "department", 120, errors);
  return { isValid: errors.length === 0, errors, data: { dateRange, department: department || null } };
}

function validateLearnerAnalyticsQuery(query = {}) {
  const errors = [];
  const data = readPagination(query, errors);
  data.dateRange = resolveDateRange(query, errors);
  const department = readString(query.department, "department", 120, errors);
  if (department) data.department = department;
  const cohort = readString(query.cohort, "cohort", 120, errors);
  if (cohort) data.cohort = cohort;
  return { isValid: errors.length === 0, errors, data };
}

function validateInstructorAnalyticsQuery(query = {}) {
  const errors = [];
  const data = readPagination(query, errors);
  data.dateRange = resolveDateRange(query, errors);
  return { isValid: errors.length === 0, errors, data };
}

function validateCourseAnalyticsQuery(query = {}) {
  const errors = [];
  const data = readPagination(query, errors);
  data.dateRange = resolveDateRange(query, errors);
  const categoryId = readString(query.categoryId, "categoryId", 100, errors);
  if (categoryId) data.categoryId = categoryId;
  return { isValid: errors.length === 0, errors, data };
}

function validateAssessmentQuery(query = {}) {
  const errors = [];
  const data = readPagination(query, errors);
  data.dateRange = resolveDateRange(query, errors);
  const courseId = readString(query.courseId, "courseId", 100, errors);
  if (courseId) data.courseId = courseId;
  return { isValid: errors.length === 0, errors, data };
}

function validateCertificateQuery(query = {}) {
  const errors = [];
  const data = readPagination(query, errors);
  data.dateRange = resolveDateRange(query, errors);
  return { isValid: errors.length === 0, errors, data };
}

function validateAttendanceQuery(query = {}) {
  const errors = [];
  const data = readPagination(query, errors);
  data.dateRange = resolveDateRange(query, errors);
  return { isValid: errors.length === 0, errors, data };
}

const AUDIT_ACTIONS_FREE_TEXT_MAX = 80;

function validateAuditQuery(query = {}) {
  const errors = [];
  const data = readPagination(query, errors);
  data.dateRange = resolveDateRange(query, errors);
  const search = readString(query.search, "search", MAX.search, errors);
  if (search) data.search = search;
  const action = readString(query.action, "action", AUDIT_ACTIONS_FREE_TEXT_MAX, errors);
  if (action) data.action = action.toUpperCase();
  // Multi-action filter (e.g. Roles & Permissions' Audit & Tracking tab,
  // which needs every COMPANY_ROLE_*/DELEGATED_ADMIN_* action at once) —
  // additive alongside the single `action` param, never combined by callers.
  const actionsRaw = readString(query.actions, "actions", 500, errors);
  if (actionsRaw) data.actions = actionsRaw.split(",").map((a) => a.trim().toUpperCase()).filter(Boolean).slice(0, 30);
  const userId = readString(query.userId, "userId", 100, errors);
  if (userId) data.userId = userId;
  return { isValid: errors.length === 0, errors, data };
}

function validateEngagementQuery(query = {}) {
  const errors = [];
  const dateRange = resolveDateRange(query, errors);
  return { isValid: errors.length === 0, errors, data: { dateRange } };
}

// ── Part 2 — Export Center + Compliance ─────────────────────────────────────

const EXPORT_TYPES = new Set(["learners", "instructors", "courses", "certificates", "assessments", "attendance", "audit"]);
const EXPORT_FORMATS = new Set(["csv", "json"]);

function validateExportQuery(query = {}) {
  const errors = [];
  const type = query.type ? String(query.type).trim().toLowerCase() : "";
  if (!EXPORT_TYPES.has(type)) errors.push(`type must be one of: ${[...EXPORT_TYPES].join(", ")}.`);

  const format = query.format ? String(query.format).trim().toLowerCase() : "csv";
  if (!EXPORT_FORMATS.has(format)) errors.push(`format must be one of: ${[...EXPORT_FORMATS].join(", ")}.`);

  const dateRange = resolveDateRange(query, errors);

  return { isValid: errors.length === 0, errors, data: { type, format, dateRange } };
}

function validateComplianceQuery(query = {}) {
  const errors = [];
  const dateRange = resolveDateRange(query, errors);
  const departmentId = readString(query.departmentId, "departmentId", 100, errors);
  return { isValid: errors.length === 0, errors, data: { dateRange, departmentId: departmentId || null } };
}

// ── Saved Reports (Custom Reports builder) ──────────────────────────────────
//
// dataSource reuses EXPORT_TYPES (uppercased for storage/response, same
// values as GET /reports/export's `type`) — one list of valid data sources,
// not two. COLUMNS_BY_SOURCE lives in savedReports.service.js (it mirrors
// getExportData's real column keys, the query engine, not a validator
// concern) — selectedColumns is checked against it there, not here.

const VISUALIZATIONS = new Set(["TABLE", "LINE_CHART", "BAR_CHART", "PIE_CHART", "KPI_CARDS"]);
const SAVED_REPORT_MAX = { name: 150, description: 1000, columns: 30, columnName: 60, schedule: 120 };

function readDataSource(value, errors) {
  const s = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!EXPORT_TYPES.has(s)) errors.push(`dataSource must be one of: ${[...EXPORT_TYPES].map((t) => t.toUpperCase()).join(", ")}.`);
  return s.toUpperCase();
}

function readSelectedColumns(value, errors) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) { errors.push("selectedColumns must be an array of strings."); return []; }
  if (value.length > SAVED_REPORT_MAX.columns) { errors.push(`selectedColumns must have at most ${SAVED_REPORT_MAX.columns} entries.`); return []; }
  const out = [];
  for (const v of value) {
    if (typeof v !== "string" || !v.trim() || v.length > SAVED_REPORT_MAX.columnName) {
      errors.push("Each selected column must be a non-empty string.");
      return [];
    }
    out.push(v.trim());
  }
  return out;
}

// filters is stored as-is (Json) but its dateRange/dateFrom/dateTo are
// pre-validated here with the same rules every other report endpoint uses —
// a bad filters payload 400s at save time, not silently at run time.
function readFilters(value, errors) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) { errors.push("filters must be an object."); return null; }
  const localErrors = [];
  resolveDateRange(value, localErrors);
  if (localErrors.length > 0) { errors.push(...localErrors); return null; }
  return value;
}

function readVisualization(value, errors, { required = false } = {}) {
  if (value === undefined) {
    if (required) errors.push("visualization is required.");
    return undefined;
  }
  const s = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!VISUALIZATIONS.has(s)) { errors.push(`visualization must be one of: ${[...VISUALIZATIONS].join(", ")}.`); return undefined; }
  return s;
}

function validateSavedReportCreate(body = {}) {
  const errors = [];
  const data = {};

  data.name = readString(body.name, "name", SAVED_REPORT_MAX.name, errors, { required: true });
  data.description = body.description === undefined ? null : (body.description === null ? null : readString(body.description, "description", SAVED_REPORT_MAX.description, errors, { required: false }));
  data.dataSource = readDataSource(body.dataSource, errors);
  data.selectedColumns = readSelectedColumns(body.selectedColumns, errors);
  data.filters = readFilters(body.filters, errors);
  data.visualization = readVisualization(body.visualization, errors) ?? "TABLE";

  if (body.schedule !== undefined && body.schedule !== null) {
    if (typeof body.schedule !== "string" || body.schedule.length > SAVED_REPORT_MAX.schedule) errors.push(`schedule must be a string of at most ${SAVED_REPORT_MAX.schedule} characters.`);
    else data.schedule = body.schedule.trim() || null;
  } else {
    data.schedule = null;
  }

  if (body.isPublic !== undefined) {
    if (typeof body.isPublic !== "boolean") errors.push("isPublic must be a boolean.");
    else data.isPublic = body.isPublic;
  }

  return { isValid: errors.length === 0, errors, data };
}

function validateSavedReportUpdate(body = {}) {
  const errors = [];
  const data = {};

  if (body.name !== undefined) data.name = readString(body.name, "name", SAVED_REPORT_MAX.name, errors, { required: true });
  if (body.description !== undefined) data.description = body.description === null ? null : readString(body.description, "description", SAVED_REPORT_MAX.description, errors, { required: false });
  if (body.dataSource !== undefined) data.dataSource = readDataSource(body.dataSource, errors);
  if (body.selectedColumns !== undefined) data.selectedColumns = readSelectedColumns(body.selectedColumns, errors);
  if (body.filters !== undefined) data.filters = readFilters(body.filters, errors);
  if (body.visualization !== undefined) data.visualization = readVisualization(body.visualization, errors);
  if (body.schedule !== undefined) {
    if (body.schedule === null) data.schedule = null;
    else if (typeof body.schedule !== "string" || body.schedule.length > SAVED_REPORT_MAX.schedule) errors.push(`schedule must be a string of at most ${SAVED_REPORT_MAX.schedule} characters.`);
    else data.schedule = body.schedule.trim() || null;
  }
  if (body.isPublic !== undefined) {
    if (typeof body.isPublic !== "boolean") errors.push("isPublic must be a boolean.");
    else data.isPublic = body.isPublic;
  }

  if (errors.length === 0 && Object.keys(data).length === 0) errors.push("No valid fields provided to update.");
  return { isValid: errors.length === 0, errors, data };
}

module.exports = {
  EXPORT_TYPES,
  resolveDateRange,
  validateOverviewQuery,
  validateLearnerAnalyticsQuery,
  validateInstructorAnalyticsQuery,
  validateCourseAnalyticsQuery,
  validateAssessmentQuery,
  validateCertificateQuery,
  validateAttendanceQuery,
  validateAuditQuery,
  validateEngagementQuery,
  validateExportQuery,
  validateComplianceQuery,
  validateSavedReportCreate,
  validateSavedReportUpdate,
};
