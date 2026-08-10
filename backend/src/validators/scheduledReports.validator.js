// Scheduled Reports validators — same { isValid, errors, data } contract as
// every other *.validator.js. reportType reuses reports.validator's own
// EXPORT_TYPES (the single source of truth for the 7 valid values) rather
// than forking a second list that could drift from Export Center's.

const { EXPORT_TYPES } = require("./reports.validator");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FORMATS = new Set(["CSV", "JSON"]);
const FREQUENCIES = new Set(["DAILY", "WEEKLY", "MONTHLY"]);
const MAX = { name: 150, recipients: 20 };

function readName(value, errors, { required }) {
  if (value === undefined || value === null) {
    if (required) errors.push("name is required.");
    return undefined;
  }
  if (typeof value !== "string") { errors.push("name must be a string."); return undefined; }
  const s = value.trim();
  if (!s) { if (required) errors.push("name is required."); return undefined; }
  if (s.length > MAX.name) { errors.push(`name must be at most ${MAX.name} characters.`); return undefined; }
  return s;
}

function readReportType(value, errors, { required }) {
  if (value === undefined || value === null) {
    if (required) errors.push("reportType is required.");
    return undefined;
  }
  const s = String(value).trim().toLowerCase();
  if (!EXPORT_TYPES.has(s)) { errors.push(`reportType must be one of: ${[...EXPORT_TYPES].join(", ")}.`); return undefined; }
  return s;
}

function readFormat(value, errors, { required }) {
  if (value === undefined || value === null) {
    if (required) errors.push("format is required.");
    return undefined;
  }
  const s = String(value).trim().toUpperCase();
  if (!FORMATS.has(s)) { errors.push("format must be one of: CSV, JSON."); return undefined; }
  return s;
}

function readFrequency(value, errors, { required }) {
  if (value === undefined || value === null) {
    if (required) errors.push("frequency is required.");
    return undefined;
  }
  const s = String(value).trim().toUpperCase();
  if (!FREQUENCIES.has(s)) { errors.push("frequency must be one of: DAILY, WEEKLY, MONTHLY."); return undefined; }
  return s;
}

// recipients: required + non-empty on create, optional (but still validated
// if present) on update. Deduped, capped, every entry a real email address.
function readRecipients(value, errors, { required }) {
  if (value === undefined) {
    if (required) errors.push("recipients is required.");
    return undefined;
  }
  if (!Array.isArray(value) || value.length === 0) { errors.push("recipients must be a non-empty array of email addresses."); return undefined; }
  if (value.length > MAX.recipients) { errors.push(`recipients must have at most ${MAX.recipients} addresses.`); return undefined; }
  const cleaned = [];
  for (const raw of value) {
    if (typeof raw !== "string" || !EMAIL_REGEX.test(raw.trim())) { errors.push(`"${raw}" is not a valid email address.`); return undefined; }
    const email = raw.trim().toLowerCase();
    if (!cleaned.includes(email)) cleaned.push(email);
  }
  return cleaned;
}

// filters is a passthrough JSON blob (dateRange/department/etc., same shape
// GET /reports/export's query params take) — only type-checked here, not
// deeply validated, since the background job tolerates a missing/invalid
// dateRange by falling back to "month" (see scheduledReports.service.js).
function readFilters(value, errors) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) { errors.push("filters must be an object."); return undefined; }
  return value;
}

function validateCreate(body = {}) {
  const errors = [];
  const data = {};
  data.name = readName(body.name, errors, { required: true });
  data.reportType = readReportType(body.reportType, errors, { required: true });
  data.format = readFormat(body.format, errors, { required: true });
  data.frequency = readFrequency(body.frequency, errors, { required: true });
  data.recipients = readRecipients(body.recipients, errors, { required: true });
  const filters = readFilters(body.filters, errors);
  if (errors.length === 0) data.filters = filters;
  return { isValid: errors.length === 0, errors, data };
}

// PATCH — every field optional, only what's present gets validated/returned.
function validateUpdate(body = {}) {
  const errors = [];
  const data = {};
  if (body.name !== undefined) { const v = readName(body.name, errors, { required: true }); if (v !== undefined) data.name = v; }
  if (body.reportType !== undefined) { const v = readReportType(body.reportType, errors, { required: true }); if (v !== undefined) data.reportType = v; }
  if (body.format !== undefined) { const v = readFormat(body.format, errors, { required: true }); if (v !== undefined) data.format = v; }
  if (body.frequency !== undefined) { const v = readFrequency(body.frequency, errors, { required: true }); if (v !== undefined) data.frequency = v; }
  if (body.recipients !== undefined) { const v = readRecipients(body.recipients, errors, { required: true }); if (v !== undefined) data.recipients = v; }
  if (body.filters !== undefined) { const v = readFilters(body.filters, errors); if (errors.length === 0) data.filters = v; }
  if (Object.keys(data).length === 0 && errors.length === 0) errors.push("At least one field must be provided.");
  return { isValid: errors.length === 0, errors, data };
}

const MAX_LIST_LIMIT = 100;

function validateListQuery(query = {}) {
  const errors = [];
  const data = { page: 1, limit: 20 };
  if (query.page !== undefined) {
    const n = Number(query.page);
    if (!Number.isInteger(n) || n < 1) errors.push("page must be a positive integer.");
    else data.page = n;
  }
  if (query.limit !== undefined) {
    const n = Number(query.limit);
    if (!Number.isInteger(n) || n < 1 || n > MAX_LIST_LIMIT) errors.push(`limit must be an integer between 1 and ${MAX_LIST_LIMIT}.`);
    else data.limit = n;
  }
  if (query.status !== undefined) {
    const s = String(query.status).trim().toUpperCase();
    if (!["ACTIVE", "PAUSED", "CANCELLED"].includes(s)) errors.push("status must be one of: ACTIVE, PAUSED, CANCELLED.");
    else data.status = s;
  }
  return { isValid: errors.length === 0, errors, data };
}

module.exports = {
  validateCreate,
  validateUpdate,
  validateListQuery,
};
